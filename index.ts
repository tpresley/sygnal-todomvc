// import css files (Vite auto injects these properly during bundling)
import './base.css';
import './index.css';

// import Sygnal's run() funtion to start the app
import { run } from 'sygnal';

// import additional drivers
import DOMfxDriver from './lib/DOMfxDriver';
import localStorageDriver from './lib/localStorageDriver';
import routerDriver from './lib/routerDriver';

// import the root component
import App from './app';

// collect additional drivers to use in the app
const drivers = {
  // DOM side effects driver for handling non-render interactions with the page
  // mostly useful for input fields on forms
  //  - no source events
  //  - sink expects an object like { type: 'SET_VALUE', selector: '#my-input-field' value: 'Abracadabara' }
  DOMFX:  DOMfxDriver,
  // driver to handle getting and putting data to local storage
  //  - source provides a .get() method that takes a 'key' to fetch from localstorage
  //    and optionally takes a second argument for a default value to use
  //  - sink expects an object like { key: 'localstorage-key', value: 'value to save' }
  STORE:  localStorageDriver,
  // driver for setting up page routes and getting routing events
  //  - source is a stream of routing events that emits the name of the new page route
  //  - sink accepts names of routes to listen for that will then be sent to the source
  ROUTER: routerDriver,
};

// start the Sygnal (Cycle.js) application
const { hmr } = run(App, drivers);

// @ts-ignore
if (import.meta.hot) {
  // @ts-ignore
  import.meta.hot.accept('./app', hmr)
}