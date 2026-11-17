import { registerRootComponent } from 'expo';

import { registerBackgroundTask } from './src/notifications';
import App from './App';

registerBackgroundTask();
registerRootComponent(App);
