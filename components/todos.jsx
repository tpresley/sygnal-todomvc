import sampleCombine from 'xstream/extra/sampleCombine'
import { component, collection, classes, xs } from 'sygnal'
import { inputEvents } from '../lib/utils'


const todo = component({
  name: 'TODO',

  model: {

    TOGGLE:     (state) => ({ ...state, completed: !state.completed }),
    DESTROY:    (state) => undefined,

    EDIT_START: (state, data, next) => {
      const selector = '.todo-' + state.id + ' .edit'
      // update the value of the input field to the current todo title
      next('SET_EDIT_VALUE',   { selector, value: state.title })
      // set focus on the input field
      next('FOCUS_EDIT_FIELD', { selector })
      // mark the todo as being edited and save the current title in case the edit is cancelled
      return { ...state, editing: true, cachedTitle: state.title }
    },

    EDIT_DONE: (state, data) => {
      // if the todo is not being edited then don't change
      if (state.editing === false) return state
      // update the todo's title, remove the editing flag, and delete the cached title
      return { ...state, title: data, editing: false, cachedTitle: '' }
    },

    EDIT_CANCEL: (state, done, next) => {
      const selector = '.todo-' + state.id + ' .edit'
      // set the value of the edit input field back to the original title
      next('SET_EDIT_VALUE', { selector: selector, value: state.cachedTitle })
      // set the todo back to the pre-edit value and remove the editing flag
      return { ...state, title: state.cachedTitle, editing: false, cachedTitle: '' }
    },

    SET_EDIT_VALUE:   { DOMFX: (state, data) => ({ type: 'SET_VALUE', data }) },

    FOCUS_EDIT_FIELD: { DOMFX: (state, data) => ({ type: 'FOCUS', data }) },

  },

  intent: ({ DOM }) => {
    // collect DOM events and elements
    const toggle$   = DOM.select('.toggle').events('click')
    const label$    = DOM.select('.todo label').events('dblclick')
    const destroy$  = DOM.select('.destroy').events('click')
    const input$    = DOM.select('.edit')

    // get events from the input field
    //  - the inputEvents helper returns common events and automatically returns the current value
    const { value$, enter$, escape$, blur$ } = inputEvents(input$)

    // map submitted edits to the new title
    const doneEditing$ = xs.merge(enter$, blur$)
                           .compose(sampleCombine(value$))
                           .map(([_, title]) => title)


    return {
      TOGGLE:      toggle$,
      DESTROY:     destroy$,
      EDIT_START:  label$,
      EDIT_DONE:   doneEditing$,
      EDIT_CANCEL: escape$,
    }
  },

  view: ({ state }) => {
    const { id, hidden, completed, editing, title } = state
    if (hidden) return
    // calculate class for todo
    const classNames = classes('todo', 'todo-' + id, { completed, editing })

    // is the todo completed?
    const checked = !!completed

    return (
      <li className={ classNames }>
        <div className="view">
          <input className="toggle" type="checkbox" checked={ checked } />
          <label>{ title }</label>
          <button className="destroy" />
        </div>
        <input className="edit" type="text" value={ title } />
      </li>
    )
  }

})


export default collection(todo, 'todos')
