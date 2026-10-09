import { makeRouter } from 'sygnal'

// hash based routes for the visibility filters (#/, #/active, #/completed)
// - the route names double as the filter names used by the app
// - anything else falls through to 'notFound', which the app redirects back to 'all'
export const router = makeRouter({
  routes: {
    all:       '/',
    active:    '/active',
    completed: '/completed',
    notFound:  '*',
  },
  mode:   'hash',
  // keep the page where it is and leave focus alone when switching filters
  scroll: false,
  focus:  false,
})

export const { href } = router
