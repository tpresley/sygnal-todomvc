import { ABORT, classes, xs } from 'sygnal'


export default function TODO({ state }) {
  const { completed, editing, editText, title } = state
  // calculate class for todo
  const classNames = classes('todo', { completed, editing })

  // is the todo completed?
  const checked = !!completed

  return (
    <li className={ classNames }>
      <div className="view">
        <input className="toggle" type="checkbox" aria-label="Toggle todo" checked={ checked } />
        <label>{ title }</label>
        <button className="destroy" aria-label="Delete todo" />
      </div>
      {/* the edit field only exists while editing, so it always starts from the current title */}
      { editing && <input className="edit" type="text" aria-label="Edit todo" value={ editText } /> }
    </li>
  )
}

TODO.model = {

  TOGGLE:     (state) => ({ ...state, completed: !state.completed }),

  // for components used in a Sygnal collection element, setting the state
  // to undefined will delete that instance of the component and remove it
  // from the array in state that the collection is based on
  DESTROY:    (state) => undefined,

  EDIT_START: {
    // mark the todo as being edited and start the edit field from the current title
    STATE:   (state) => ({ ...state, editing: true, editText: state.title }),
    // focus the edit field once it has rendered
    // - ELEMENT is Sygnal's built-in sink for calling methods like focus() on this component's own elements
    ELEMENT: { focus: '.edit' },
  },

  // keep the edit field's text in state while typing
  EDIT_INPUT: (state, editText) => ({ ...state, editText }),

  EDIT_DONE: (state) => {
    // if the todo is not being edited then don't change
    // - removing the field after enter or escape can also blur it, which lands here a second time
    if (!state.editing) return ABORT
    const title = state.editText.trim()
    // saving an empty title deletes the todo
    if (!title) return undefined
    // update the todo's title and leave edit mode
    return { ...state, title, editing: false, editText: '' }
  },

  // throw away the edit and go back to the original title
  EDIT_CANCEL: (state) => {
    if (!state.editing) return ABORT
    return { ...state, editing: false, editText: '' }
  },

}

TODO.intent = ({ DOM }) => {
  // the keys pressed in the edit field
  const editKey$ = DOM.keydown('.edit').key()

  return {
    TOGGLE:      DOM.click('.toggle'),
    DESTROY:     DOM.click('.destroy'),
    EDIT_START:  DOM.dblclick('label'),
    EDIT_INPUT:  DOM.input('.edit').value(),
    // hitting enter or leaving the field saves the edit
    EDIT_DONE:   xs.merge(editKey$.filter(key => key === 'Enter'), DOM.blur('.edit')),
    EDIT_CANCEL: editKey$.filter(key => key === 'Escape'),
  }
}
