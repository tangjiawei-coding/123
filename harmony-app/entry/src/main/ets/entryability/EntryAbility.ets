import { ConfigurationConstant, UIAbility } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { VoiceService } from '../services/VoiceService';

export default class EntryAbility extends UIAbility {
  onCreate(): void {
    this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT);
  }
  onWindowStageCreate(stage: window.WindowStage): void {
    stage.loadContent('pages/Index');
  }
  onBackground(): void { VoiceService.current?.suspend(); }
  onDestroy(): void { VoiceService.current?.suspend(); }
}
