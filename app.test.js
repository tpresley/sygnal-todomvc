import { it, expect, afterEach } from 'vitest'
import { renderComponent } from 'sygnal'
import { router } from './lib/router'
import App from './app'

let t
afterEach(() => t?.dispose())

const render = (options = {}) => renderComponent(App, { strict: true, router, url: '/', ...options })

const addTodo = async (title) => {
  t.simulateEvent('.new-todo', 'input', { value: title })
  t.simulateEvent('.new-todo', 'keydown', { key: 'Enter' })
  await t.next(s => s.todos.some(todo => todo.title === title.trim()) && s.draft === '')
}

it('adds todos, trims titles, and ignores blank ones', async () => {
  t = render()
  await t.ready()
  expect(t.html()).not.toContain('class="main"')

  await addTodo('  Write tests  ')
  await addTodo('Ship it')
  t.simulateEvent('.new-todo', 'input', { value: '   ' })
  t.simulateEvent('.new-todo', 'keydown', { key: 'Enter' })
  await t.settle()

  expect(t.state.todos.map(todo => todo.title)).toEqual(['Write tests', 'Ship it'])
  expect(t.query('.todo-count').textContent).toContain('2 items left')
  t.expectNoDiagnostics()
})

it('toggles, toggles all, clears completed and destroys todos', async () => {
  t = render()
  await addTodo('One')
  await addTodo('Two')

  t.simulateEvent('.todo:first-child .toggle', 'click')
  await t.next(s => s.todos[0].completed)
  expect(t.query('.todo-count').textContent).toContain('1 item left')
  expect(t.query('.clear-completed')).toBeTruthy()

  t.simulateEvent('.toggle-all', 'click')
  await t.next(s => s.todos.every(todo => todo.completed))
  t.simulateEvent('.toggle-all', 'click')
  await t.next(s => s.todos.every(todo => !todo.completed))

  t.simulateEvent('.todo:last-child .toggle', 'click')
  await t.next(s => s.todos[1].completed)
  t.simulateEvent('.clear-completed', 'click')
  await t.next(s => s.todos.length === 1)

  t.simulateEvent('.destroy', 'click')
  await t.next(s => s.todos.length === 0)
  expect(t.html()).not.toContain('class="footer"')
  t.expectNoDiagnostics()
})

it('edits a todo, cancels with escape, and deletes it when emptied', async () => {
  t = render()
  await addTodo('Draft')

  t.simulateEvent('.todo label', 'dblclick')
  await t.next(s => s.todos[0].editing)
  expect(t.query('.edit').value).toBe('Draft')
  t.simulateEvent('.edit', 'input', { value: ' Final ' })
  t.simulateEvent('.edit', 'keydown', { key: 'Enter' })
  await t.next(s => s.todos[0].title === 'Final' && !s.todos[0].editing)
  
  t.simulateEvent('.todo label', 'dblclick')
  await t.next(s => s.todos[0].editing)
  t.simulateEvent('.edit', 'input', { value: 'Oops' })
  t.simulateEvent('.edit', 'keydown', { key: 'Escape' })
  await t.next(s => !s.todos[0].editing)
  expect(t.state.todos[0].title).toBe('Final')

  t.simulateEvent('.todo label', 'dblclick')
  await t.next(s => s.todos[0].editing)
  t.simulateEvent('.edit', 'input', { value: '  ' })
  t.simulateEvent('.edit', 'blur')
  await t.next(s => s.todos.length === 0)
  t.expectNoDiagnostics()
})

it('filters todos by route and redirects unknown routes', async () => {
  t = render({ storage: { 'todos-sygnal': { version: 1, state: { todos: [
    { id: 1, title: 'Open', completed: false },
    { id: 2, title: 'Done', completed: true },
  ] } } } })
  await t.ready()
  expect(t.queryAll('.todo').length).toBe(2)

  await t.navigate({ to: 'active' })
  expect(t.state.visibility).toBe('active')
  expect(t.html()).toContain('Open')
  expect(t.html()).not.toContain('Done')
  expect(t.query('.filters .selected').textContent).toBe('Active')

  await t.navigate('/#/completed')
  expect(t.queryAll('.todo').length).toBe(1)
  expect(t.html()).toContain('Done')

  await t.navigate('/#/nope')
  expect(t.state.route.name).toBe('all')
  expect(t.location.hash).toBe('#/')
  expect(t.queryAll('.todo').length).toBe(2)
  t.expectNoDiagnostics()
})

it('restores and saves todos in local storage, without edit state', async () => {
  t = render({ storage: { 'todos-sygnal': { version: 1, state: { todos: [
    { id: 1, title: 'Saved', completed: false, editing: true, editText: 'Sav' },
  ] } } } })
  await t.ready()
  await t.waitForState(s => s.todos[0] && !s.todos[0].editing)
  expect(t.state.todos[0].title).toBe('Saved')

  await addTodo('New')
  await t.settle()
  expect(t.storage('todos-sygnal').state.todos.map(todo => todo.title)).toEqual(['Saved', 'New'])
  t.expectNoDiagnostics()
})

it('links the filters to hash routes', async () => {
  t = render()
  await addTodo('One')
  const hrefs = t.queryAll('.filters a').map(a => a.getAttribute('href'))
  expect(hrefs).toEqual(['#/', '#/active', '#/completed'])
})
