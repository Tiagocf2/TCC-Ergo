import { AfterViewInit, Component, ComponentFactoryResolver, OnInit, ViewChild } from '@angular/core';
import { ViewContainerRef } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs';
import { PersonagensService } from 'src/controllers/personagens.service';
import { UsuariosService } from 'src/controllers/usuarios.service';
import PopupDefault from '../componentes/popup/default';
import { PopupService } from '../componentes/popup/popup.service';
import DefaultComponent from '../utils/default-component';
import { ComponentEnum, FindOption, MenuOptions } from './component-handler';

@Component({
  selector: 'app-logado',
  templateUrl: './logado.component.html',
  styleUrls: ['./logado.component.css'],
})
export class LogadoComponent extends DefaultComponent implements OnInit {
  MenuOptions = MenuOptions;
  defaultOption = ComponentEnum.Home;
  currentOption = this.defaultOption;
  activeComponent: any;
  userData: any = {};

  @ViewChild('componenteAqui', { read: ViewContainerRef }) DOMView: ViewContainerRef | undefined;

  constructor(
    private usuarioService: UsuariosService,
    private personagemService: PersonagensService,
    private cookie: CookieService,
    private popupService: PopupService
  ) {
    super()
    this.userData.token = this.cookie.get('token');
  }


  ngOnInit(): void {
    this.subscriptions.push(
      this.usuarioService.readUsuario(this.userData.token).subscribe(
        data => {
          this.userData = { ...this.userData, ...data };
          this.changeOption(this.defaultOption);
          this.checkOrCreatePersonagem();
        },
        error => {
          this.popupService.open({ content: PopupDefault, data: { title: "Erro", message: error.statusText } });
        }
      )
    );
  }

  changeOption(value: ComponentEnum) {

    if (this.DOMView === undefined) {
      return;
    }

    const option = FindOption(value);

    if (option === false) {
      return;
    }

    this.currentOption = option.value;
    this.DOMView.clear();

    this.activeComponent = this.DOMView.createComponent<any>(option.component);
    this.activeComponent.instance.user = this.userData;
  }

  checkOrCreatePersonagem(){
    this.subscriptions.push(
      this.personagemService.fetchByUID(this.userData.uid).subscribe(
        data => {},
        error => {
          if(error.status === 404){
            this.subscriptions.push(
              this.personagemService.createPersonagem({
                usuario: this.userData.uid,
                apelido: `Personagem de ${this.userData.nome}`,
                cor_pele: '',
                cor_olhos: ''
              }, this.userData.token).subscribe(
                data=>{},
                error=>{
                  this.popupService.open({ content: PopupDefault, data: { title: "Erro", message: error.statusText } });
                }
              )
            )
          }
          this.popupService.open({ content: PopupDefault, data: { title: "Erro", message: error.statusText } });
        }
      )
    );
  }
}
