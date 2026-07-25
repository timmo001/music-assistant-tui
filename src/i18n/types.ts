export interface Locale {
  readonly app: {
    readonly name: string;
    readonly nothingPlaying: string;
    readonly terminalTooSmall: string;
  };
  readonly menu: {
    readonly title: string;
    readonly library: string;
    readonly search: string;
    readonly players: string;
    readonly settings: string;
    readonly about: string;
    readonly quit: string;
    readonly placeholder: string;
  };
  readonly setup: {
    readonly title: string;
    readonly subtitle: string;
    readonly urlLabel: string;
    readonly urlPlaceholder: string;
    readonly tokenLabel: string;
    readonly tokenPlaceholder: string;
    readonly tokenRequired: string;
    readonly urlInvalid: string;
    readonly saving: string;
    readonly saveFailed: string;
    readonly nextField: string;
    readonly save: string;
  };
  readonly help: {
    readonly menu: string;
    readonly navigate: string;
    readonly select: string;
    readonly filter: string;
    readonly back: string;
    readonly quit: string;
    readonly playPause: string;
    readonly previous: string;
    readonly next: string;
    readonly volumeDown: string;
    readonly volumeUp: string;
    readonly mute: string;
  };
  readonly keys: {
    readonly arrowsUD: string;
    readonly enter: string;
    readonly typeInput: string;
    readonly tab: string;
    readonly esc: string;
    readonly backspace: string;
    readonly ctrl: { readonly c: string };
    readonly m: string;
  };
}
