import { ABORT, Collection, classes, persist } from 'sygnal'
import { router, href } from './lib/router'
import Todo from './components/todos'

// filter functions for each visibility option
// - the key names match the route names, and also get used as names in the UI
const FILTER_LIST = {
  all:       todo => true,
  active:    todo => !todo.completed,
  completed: todo => todo.completed
}

export default function APP ({ state }) {
  const { visibility, total, remaining, completed, allDone } = state

  // use the key names of the filter functions to make links to change the view mode
  const links = Object.keys(FILTER_LIST)

  const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1)

  // this could be a standalone component, but when no state or other component
  // functionality is needed then it makes sense to just keep it inline
  // - there is a small performance benefit to keeping it inline, but not enough
  //   to avoid creating components when it makes sense to do so
  const renderLink = link => <li><a href={ href(link) } className={ classes({ selected: visibility == link }) }>{ capitalize(link) }</a></li>

  return (
    <section className="todoapp">
      <header className="header">
        <h1>todos</h1>
        <input className="new-todo" aria-label="New todo" autofocus autocomplete="off" placeholder="What needs to be done?" value={ state.draft } />
      </header>

      { (total > 0) &&
        <section className="main">
          <input id="toggle-all" className="toggle-all" type="checkbox" checked={ allDone } />
          <label for="toggle-all">Mark all as complete</label>
          <ul className="todo-list">
            {/* use Sygnal's built-in Collection element to create multiple todos from the 'todos'
                array in state and filter the array based on the currently selected visibility */}
            <Collection of={ Todo } from="todos" filter={ FILTER_LIST[visibility] } />
          </ul>
        </section>
      }

      { (total > 0) &&
        <footer className="footer">
          <span className="todo-count">
            <strong>{ remaining }</strong> { (remaining === 1) ? 'item' : 'items' } left
          </span>
          <ul className="filters">
            { links.map(renderLink) }
          </ul>
          { (completed > 0) && <button className="clear-completed">Clear completed</button> }
        </footer>
      }

    </section>
  )
}


APP.initialState = {
  // seeding the route lets the very first render show the right filter
  route: router.current(),
  draft: '',
  todos: []
}

// save the todos to local storage after every change, and restore them before the first render
// - only the todos are kept: the route comes from the URL and the draft is thrown away
APP.persist = persist({ key: 'todos-sygnal', pick: ['todos'] })

// the ROUTE action fires on start and on every hash change with { name, params, query, hash, path }
APP.route = 'ROUTE'

// values that can derived from the current state, and are used in multiple places
// can be added as calculated fields, and will automatically be added wherever state
// is used in the component. This is useful for reducing redundant code.
APP.calculated = {
  visibility: (state) => (state.route.name in FILTER_LIST) ? state.route.name : 'all',
  total:      (state) => state.todos.length,
  remaining:  (state) => state.todos.filter(todo => !todo.completed).length,
  completed:  (state) => state.todos.filter(todo => todo.completed).length,
  allDone:    (state) => state.todos.every(todo => todo.completed),
}

APP.model = {
  // the special BOOTSTRAP action is called once when a component is instantiated
  // - this is similar to onMount or useEffect(() => {...}, []) in React
  // - a todo that was being edited when the page was closed comes back out of edit mode
  BOOTSTRAP: (state) => {
    if (!state.todos.some(todo => todo.editing)) return ABORT
    const todos = state.todos.map(({ id, title, completed }) => ({ id, title, completed }))
    return { ...state, todos }
  },

  // change which todos are shown based on the current route (All, Active, Completed)
  // - unknown routes get redirected back to the 'all' route
  ROUTE: {
    STATE:  (state, route) => ({ ...state, route }),
    ROUTER: (state, route) => (route.name === 'notFound') ? { to: 'all', replace: true } : ABORT,
  },

  // keep the new todo field's text in state
  DRAFT: (state, draft) => ({ ...state, draft }),

  NEW_TODO: (state) => {
    const title = state.draft.trim()
    if (!title) return ABORT

    // calculate next id
    // - must be unique even after a browser page refresh
    // - using timestamp for simplicity, but could be UUID or something else
    const newTodo = {
      id: Date.now(),
      title,
      completed: false
    }

    // add the new todo to the state and clear the new todo field
    return {
      ...state,
      draft: '',
      todos: [ ...state.todos, newTodo ]
    }
  },

  TOGGLE_ALL: (state) => {
    const todos = state.todos.map(todo => ({ ...todo, completed: !state.allDone }))
    return { ...state, todos }
  },

  CLEAR_COMPLETED: (state) => {
    const todos = state.todos.filter(todo => !todo.completed)
    return { ...state, todos }
  },
}

APP.intent = ({ DOM }) => ({
  // the new todo field is a controlled input, and hitting enter adds the todo
  DRAFT:           DOM.input('.new-todo').value(),
  NEW_TODO:        DOM.keydown('.new-todo').key().filter(key => key === 'Enter'),
  TOGGLE_ALL:      DOM.click('.toggle-all'),
  CLEAR_COMPLETED: DOM.click('.clear-completed'),
})
