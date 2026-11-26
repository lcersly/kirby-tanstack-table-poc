import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideKirby, withGlobalSetup } from '@kirbydesign/designsystem/config';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideKirby(withGlobalSetup()),
    { provide: LOCALE_ID, useValue: 'da-DK' },
  ],
};
