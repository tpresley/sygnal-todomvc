// import css files (Vite auto injects these properly during bundling)
import './base.css'
import './index.css'

// import Sygnal's run() function to start the app
import { run } from 'sygnal'

// the hash router that drives the visibility filters
import { router } from './lib/router'

// import the root component
import App from './app'

// start the Sygnal application
// - DOM, STATE, EVENTS, ELEMENT and PERSIST are built in, so only the router needs adding
run(App, { ROUTER: router.driver })
