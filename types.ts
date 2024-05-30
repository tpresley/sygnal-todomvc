import { Stream } from 'sygnal/types'

export type Todo = {
  id: number,
  completed?: boolean,
  editing?: boolean,
  title: string
  cachedTitle?: string
}

export type Filters = 'all' | 'active' | 'completed'

export type AppState = {
  todos: Todo[],
  visibility: Filters
}

export type AppDrivers = {
  DOMFX: {
    source: never,
    sink: { type: string, data: any }
  },
  STORE: {
    source: { get: (key: string, defaultValue: any) => Stream<Todo[]> },
    sink: { key: string, value: any }
  },
  ROUTER: {
    source: Stream<Filters>,
    sink: Filters
  },
}

export type AppActions = {
  VISIBILITY: Filters,
  FROM_STORE: Todo[],
  NEW_TODO: string,
  TOGGLE_ALL: null,
  CLEAR_COMPLETED: null,
  CLEAR_FORM: null,
  ADD_ROUTE: Filters,
  TO_STORE: null
}

export type AppCalculated = {
  total:     number,
  remaining: number,
  completed: number,
  allDone:   boolean,
}

export type TodoActions = {
  TOGGLE: null,
  DESTROY: null,
  EDIT_START: null,
  EDIT_DONE: string,
  EDIT_CANCEL: null,
  SET_EDIT_VALUE: { selector: string, value: string },
  FOCUS_EDIT_FIELD: { selector: string }
}

export type TodoCalculated = {
  inputSelector: string
}