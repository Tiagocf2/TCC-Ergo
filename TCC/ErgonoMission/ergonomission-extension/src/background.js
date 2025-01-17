
/* ********************* */
/* ***** Constants ***** */
/* ********************* */

export const STORAGE_POMODORO = "pom__instance";
export const MSG_POMODORO = "pom_msg";
export const MSG_POMODORO_PAUSE = "pom_msg_pause";

export const ALARM_POMODORO = "pom_alarm";
export const ALARM_POMODORO_BREAK = "pom_alarm_break";

export const NOTIFICATION_POMODORO = "pom_notification";
export const NOTIFICATION_POMODORO_BREAK = "pom_notification_break";
export const NOTIFICATION_POMODORO_BREAK_END = "pom_notification_break_end";
export const NOTIFICATION_POMODORO_END = "pom_notification_end";

const basicNotificationOptions = {
  iconUrl: "./assets/img/play.png",
  requireInteraction: true,
  priority: 2,
}

/* ****************** */
/* ***** Events ***** */
/* ****************** */

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.clear(ALARM_POMODORO)
  chrome.alarms.clear(ALARM_POMODORO_BREAK)
  chrome.notifications.clear(NOTIFICATION_POMODORO);
  chrome.notifications.clear(NOTIFICATION_POMODORO_END);
  chrome.notifications.clear(NOTIFICATION_POMODORO_BREAK);
  chrome.notifications.clear(NOTIFICATION_POMODORO_BREAK_END);
  chrome.storage.sync.clear();
  console.log('Succefully running Ergonomission service-worker!');
});

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.name === MSG_POMODORO) {
      chrome.alarms.clear(ALARM_POMODORO);
      chrome.alarms.clear(ALARM_POMODORO_BREAK);
      chrome.notifications.clear(NOTIFICATION_POMODORO);
      chrome.notifications.clear(NOTIFICATION_POMODORO_END);
      chrome.notifications.clear(NOTIFICATION_POMODORO_BREAK);
      chrome.notifications.clear(NOTIFICATION_POMODORO_BREAK_END);
      registerPomodoro(request.pomodoro);
    }

    if (request.name === MSG_POMODORO_PAUSE) {
      chrome.alarms.clear(ALARM_POMODORO);
      chrome.alarms.clear(ALARM_POMODORO_BREAK);
      chrome.notifications.update(NOTIFICATION_POMODORO, { message: 'Ciclo pausado' });
      chrome.notifications.update(NOTIFICATION_POMODORO_BREAK, { message: 'Ciclo pausado' });
    }
    sendResponse('Mensagem recebida: ', request.name);
  }
);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name == ALARM_POMODORO) {
    chrome.storage.sync.get('alarm_is_running',
      (itens) => {
        if (itens['alarm_is_running'] == true) {
          return;
        }
        if (itens['alarm_is_running'] == undefined) {
          chrome.storage.sync.set({ 'alarm_is_running': true }, () => {
            pomodoroAlarmHandler();
          })
        }
      })

  }

  if (alarm.name == ALARM_POMODORO_BREAK) {
    chrome.storage.sync.get("pom__notification_time", (time) => {
      let newT = time.pom__notification_time + 50;
      if(newT >= 100){ 
        _pomodoroBreakEnd();
      } else {
        chrome.storage.sync.set({ "pom__notification_time": newT });
        chrome.notifications.update(NOTIFICATION_POMODORO_BREAK, { progress: newT });
      }
    })
  }

});

chrome.notifications.onButtonClicked.addListener((id) => {
  if (id === NOTIFICATION_POMODORO_BREAK) {
    chrome.storage.sync.set({ "redirect": "alongamentos" }, () => {
      chrome.windows.create({ 'url': 'index.html', 'type': 'popup', 'width': 800, 'height': 600 });
    })
  }
});


/* ********************* */
/* ***** Functions ***** */
/* ********************* */

const registerPomodoro = (pomodoro) => {
  const waitTime = 60000 - pomodoro.time % 60000;
  pomodoro.waitTime = waitTime;
  pomodoro.waitStart = Date.now();
  chrome.storage.sync.set({
    [STORAGE_POMODORO]: pomodoro
  }).then(() => {
    chrome.alarms.create(ALARM_POMODORO, { when: Date.now() + waitTime, periodInMinutes: 1 });
    console.log(`Sucesso ao criar alarme para o ciclo ${pomodoro.title}!`);
    chrome.notifications.create(NOTIFICATION_POMODORO, {
      type: "progress",
      title: pomodoro.title,
      message: `Ciclo ${pomodoro.isPaused ? 'pausado' : 'em andamento'}`,
      progress: parseInt((pomodoro.time / pomodoro.duration) * 100, 10),
      ...basicNotificationOptions
    })
      ;
  })
}

const pomodoroAlarmHandler = () => {
  chrome.storage.sync.get([STORAGE_POMODORO])
    .then((itens) => {
      const pomodoro = itens[STORAGE_POMODORO];
      if (!pomodoro) {
        return;
      }
      if (pomodoro.waitTime > 0) {
        pomodoro.time += pomodoro.waitTime;
        pomodoro.waitTime = 0;
      } else {
        pomodoro.time += 60 * 1000;
      }
      let newT = parseInt((pomodoro.time / pomodoro.duration) * 100, 10)
      chrome.notifications.update(NOTIFICATION_POMODORO,
        {
          progress: newT,
          message: `Ciclo ${pomodoro.isPaused ? 'pausado' : 'em andamento'}`,
        }
      );

      if (pomodoro.time >= pomodoro.duration) {
        pomodoro.hasFinished = true;
        _pomodoroFinish(pomodoro);
      }

      pom_checkState(pomodoro).then((pom) => {
        chrome.storage.sync.set({ [STORAGE_POMODORO]: pom, 'alarm_is_running': false });
      });
    });
}

const _pomodoroFinish = (pom) => {
  chrome.alarms.clear(ALARM_POMODORO)

    .then(() => {
      chrome.notifications.create(NOTIFICATION_POMODORO_END, {
        type: "basic",
        title: `Concluiu ${pom.title}!`,
        contextMessage: "Parabéns! 🎉👏",
        message: "Vá ao ErgonoMission para checar seus pontos ganhos.",
        ...basicNotificationOptions,
      });
    });
}

const _pomodoroBreakStart = (time = 0) => {
  console.log('...Break Started');
  chrome.alarms.clear(ALARM_POMODORO_BREAK);
  chrome.notifications.clear(NOTIFICATION_POMODORO_BREAK);
  chrome.notifications.create(NOTIFICATION_POMODORO_BREAK, {
    type: "progress",
    title: `Hora da Pausa!`,
    message: "Descanse um pouco 👍",
    contextMessage: "Bom trabalho!",
    buttons: [{
      title: "Ver alongamentos"
    }],
    ...basicNotificationOptions,
  }, () => {
    //duration = duration/1000;
    chrome.storage.sync.set({ "pom__notification_time": time }, () => {
      chrome.alarms.create(ALARM_POMODORO_BREAK, { periodInMinutes: 0.5 }); //Duracao em segundos / 100 / 60
    });
  });
};
const _pomodoroBreakEnd = () => {
  console.log('...Break Ended');
  chrome.storage.sync.set({ "pom__notification_time": null });
  chrome.alarms.clear(ALARM_POMODORO_BREAK);
  chrome.notifications.clear(NOTIFICATION_POMODORO_BREAK);
  chrome.notifications.create(NOTIFICATION_POMODORO_BREAK_END, {
    type: "basic",
    title: `Fim da Pausa!`,
    message: "Voltando ao trabalho!",
    requireInteraction: false,
    priority: 2,
    ...basicNotificationOptions
  });
}


/* ***** Pomodoro ***** */

const pom_checkState = (pom) => {
  console.log('Checking State...');

  //60000 - 0 == 60000
  if (!pom.isOnBreak && (pom.time - pom.lastBreak) == pom.BREAK_INTERVAL) {
    pom.isOnBreak = true;
    pom.lastBreak = pom.time;
    _pomodoroBreakStart(pom.time - pom.lastBreak);
  }
  //true && 180000 - 
  //false && 90000 - 60000 = 30000
  if (pom.isOnBreak && (pom.time - pom.lastBreak) == pom.SHORT_BREAK) {
    pom.isOnBreak = false;
    pom.lastBreak = pom.time;
    _pomodoroBreakEnd();
  }

  chrome.storage.sync.set({ [STORAGE_POMODORO]: pom })

  return new Promise((resolve) => {
    resolve(pom);
  });
}