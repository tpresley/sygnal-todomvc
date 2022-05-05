'use strict'

import isolate from '@cycle/isolate'
import { makeCollection } from '@cycle/state'

import xs, { Stream } from 'xstream'
import Delay from 'xstream/extra/delay.js'
import Concat from 'xstream/extra/concat.js'
import debounce from 'xstream/extra/debounce.js'
import DropRepeats from 'xstream/extra/dropRepeats.js'

import makeLog from './makeLog.js'

// import syntax has bugs for xstream in Node context
// this attempts to normalize to work in both Node and browser
if (!xs.never && xs.default && xs.default.never) {
  xs.never = xs.default.never
  xs.merge = xs.default.merge
  xs.of    = xs.default.of
}
const concat = (Concat && Concat.default) ? Concat.default : Concat
const delay  = (Delay && Delay.default) ? Delay.default : Delay
const dropRepeats = (DropRepeats && DropRepeats.default) ? DropRepeats.default : DropRepeats

const DEBUG = process.env.DEBUG == 'true' || process.env.DEBUG === true


const REQUEST_SELECTOR_METHOD = 'request'
const BOOTSTRAP_ACTION        = 'BOOTSTRAP'
const INITIALIZE_ACTION       = 'INITIALIZE'
const HYDRATE_ACTION          = 'HYDRATE'



export const ABORT = '~~ABORT~~'

export function component (opts) {
  const { name, sources, isolateOpts, stateSourceName='STATE' } = opts

  if (typeof name !== 'string') {
    throw new Error(`No name provided for component!`)
  }

  if (sources && typeof sources !== 'object') {
    throw new Error('Sources must be a Cycle.js sources object:', name)
  }

  let fixedIsolateOpts
  if (typeof isolateOpts == 'string') {
    fixedIsolateOpts = { [stateSourceName]: isolateOpts }
  } else {
    if (isolateOpts === true) {
      fixedIsolateOpts = {}
    } else {
      fixedIsolateOpts = isolateOpts
    }
  }

  const currySources = typeof sources === 'undefined'

  if (typeof fixedIsolateOpts == 'object') {
    const wrapped = (sources) => {
      const fixedOpts = { ...opts, sources }
      return (new Component(fixedOpts)).sinks
    }
    return currySources ? isolate(wrapped, fixedIsolateOpts) : isolate(wrapped, fixedIsolateOpts)(sources)
  } else {
    return currySources ? (sources) => (new Component({ ...opts, sources })).sinks : (new Component(opts)).sinks
  }
}





class Component {
  // [ PASSED PARAMETERS ]
  // name
  // sources
  // intent
  // request
  // action
  // response
  // view
  // children
  // initialState
  // DOMSourceName
  // stateSourceName
  // requestSourceName

  // [ PRIVATE / CALCULATED VALUES ]
  // sourceNames
  // intent$
  // action$
  // model$
  // response$
  // sendResponse$
  // children$
  // vdom$

  // [ INSTANTIATED STREAM OPERATOR ]
  // log

  // [ OUTPUT ]
  // sinks

  constructor({ name='NO NAME', sources, intent, request, action, response, view, children={}, initialState, DOMSourceName='DOM', stateSourceName='STATE', requestSourceName='HTTP' }) {
    if (!sources || typeof sources != 'object') throw new Error('Missing or invalid sources')

    this.name     = name
    this.sources  = sources
    this.intent   = intent
    this.request  = request
    this.action   = action
    this.response = response
    this.view     = view
    this.children = children
    this.initialState      = initialState
    this.DOMSourceName     = DOMSourceName
    this.stateSourceName   = stateSourceName
    this.requestSourceName = requestSourceName
    this.sourceNames       = Object.keys(sources)

    const state$ = sources[stateSourceName].stream && sources[stateSourceName].stream

    if (state$) {
      this.currentState = {}
      this.sources[this.stateSourceName].stream.subscribe({
        next: val => {
          this.currentState = val
        }
      })
    }

    this.log = makeLog(name)

    this.initIntent$()
    this.initAction$()
    this.initResponse$()
    this.initState()
    this.initModel$()
    this.initSendResponse$()
    this.initChildren$()
    this.initVdom$()
    this.initSinks()
  }

  initIntent$() {
    if (!this.intent) {
      return
    }
    if (typeof this.intent != 'function') {
      throw new Error('Intent must be a function')
    }

    this.intent$ = this.intent(this.sources)

    if (!(this.intent$ instanceof Stream) && (typeof this.intent$ != 'object')) {
      throw new Error('Intent must return either an action$ stream or map of event streams')
    }
  }

  initAction$() {
    const requestSource  = (this.sources && this.sources[this.requestSourceName]) || null

    if (!this.intent$) {
      this.action$ = xs.never()
      return
    }

    let runner
    if (this.intent$ instanceof Stream) {
      runner = this.intent$
    } else {
      const mapped = Object.entries(this.intent$)
                           .map(([type, data$]) => data$.map(data => ({type, data})))
      runner = xs.merge(xs.never(), ...mapped)
    }

    const action$  = ((runner instanceof Stream) ? runner : (runner.apply && runner(this.sources) || xs.never()))
    const wrapped$ = concat(xs.of({ type: BOOTSTRAP_ACTION }), action$)
      .compose(delay(0))

    let initialApiData
    if (requestSource && typeof requestSource.select == 'function') {
      initialApiData = requestSource.select('initial')
        .flatten()
    } else {
      initialApiData = xs.never()
    }

    const hydrate$ = initialApiData.map(data => ({ type: HYDRATE_ACTION, data }))

    this.action$   = xs.merge(wrapped$, hydrate$)
      .compose(this.log(({ type }) => `Action triggered: <${ type }>`))
  }

  initResponse$() {
    if (typeof this.request == 'undefined') {
      return
    } else if (typeof this.request != 'object') {
      throw new Error('The request parameter must be an object')
    }

    const router$ = this.sources[this.requestSourceName]
    const methods = Object.entries(this.request)

    const wrapped = methods.reduce((acc, [method, routes]) => {
      const _method = method.toLowerCase()
      if (typeof router$[_method] != 'function') {
        throw new Error('Invalid method in request object:', method)
      }
      const entries = Object.entries(routes)
      const mapped = entries.reduce((acc, [route, action]) => {
        const routeString = `[${_method.toUpperCase()}]:${route || 'none'}`
        const actionType = typeof action
        if (actionType === 'undefined') {
          throw new Error(`Action for '${ route }' route in request object not specified`)
        } else if (actionType !== 'string' && actionType !== 'function') {
          throw new Error(`Invalid action for '${ route }' route: expecting string or function`)
        }
        const actionString = (actionType === 'function') ? '[ FUNCTION ]' : `< ${ action } >`
        console.log(`[${ this.name }] Adding ${ this.requestSourceName } route:`, _method.toUpperCase(), `'${ route }' <${ actionString }>`)
        const route$ = router$[_method](route)
          .compose(dropRepeats((a, b) => a.id == b.id))
          .map(req => {
            if (!req || !req.id) {
              throw new Error(`No id found in request: ${ routeString }`)
            }
            try {
              const _reqId  = req.id
              const params  = req.params
              const body    = req.body
              const cookies = req.cookies
              const type    = (actionType === 'function') ? 'FUNCTION' : action
              const data    = { params, body, cookies, req }
              const obj     = { type, data: body, req, _reqId, _action: type }

              const timestamp = (new Date()).toISOString()
              const ip = req.get ? req.get('host') : '0.0.0.0'

              console.log(`${ timestamp } ${ ip } ${ req.method } ${ req.url }`)

              if (DEBUG) {
                this.action$.setDebugListener({next: ({ type }) => console.log(`[${ this.name }] Action from ${ this.requestSourceName } request: <${ type }>`)})
              }

              if (actionType === 'function') {
                const result = action(this.currentState, req)
                return xs.of({ ...obj, data: result })
              } else {
                this.action$.shamefullySendNext(obj)

                const sourceEntries = Object.entries(this.sources)
                const responses     = sourceEntries.reduce((acc, [name, source]) => {
                  if (!source || typeof source[REQUEST_SELECTOR_METHOD] != 'function') return acc
                  const selected$ = source[REQUEST_SELECTOR_METHOD](_reqId)
                  return [ ...acc, selected$ ]
                }, [])
                return xs.merge(...responses)
              }
            } catch(err) {
              console.error(err)
            }
          }).flatten()
        return [ ...acc, route$ ]
      }, [])
      const mapped$ = xs.merge(...mapped)
      return [ ...acc, mapped$ ]
    }, [])

    this.response$ = xs.merge(...wrapped)
      .compose(this.log(res => {
        if (res._action) return `[${ this.requestSourceName }] response data received for Action: <${ res._action }>`
        return `[${ this.requestSourceName }] response data received from FUNCTION`
      }))

    if (typeof this.response != 'undefined' && typeof this.response$ == 'undefined') {
      throw new Error('Cannot have a response parameter without a request parameter')
    }
  }

  initState() {
    if (this.action != undefined) {
      if (this.action[INITIALIZE_ACTION] === undefined) {
        this.action[INITIALIZE_ACTION] = {
          [this.stateSourceName]: (_, data) => ({ ...data })
        }
      } else {
        Object.keys(this.action[INITIALIZE_ACTION]).forEach(name => {
          if (name !== this.stateSourceName) {
            console.warn(`${ INITIALIZE_ACTION } can only be used with the ${ this.stateSourceName } source... disregarding ${ name }`)
            delete this.action[INITIALIZE_ACTION][name]
          }
        })
      }
    }
  }

  initModel$() {
    if (typeof this.action == 'undefined') {
      this.model$ = this.sourceNames.reduce((a,s) => {
        a[s] = xs.never()
        return a
      }, {})
      return
    }

    const onNormal = this.makeOnAction(this.action$, false, this.action$)

    const initial = { type: INITIALIZE_ACTION, data: this.initialState }
    const shimmed$ = this.initialState ? concat(xs.of(initial), this.action$).compose(delay(0)) : this.action$
    const onState  = this.makeOnAction(shimmed$, true, this.action$)


    const actionEntries = Object.entries(this.action)

    const reducers = {}

    actionEntries.forEach((entry) => {
      const [action, sinks] = entry

      if (typeof sinks !== 'object') {
        throw new Error(`Entry for each action must be an object: ${ this.name } ${ action }`)
      }

      const sinkEntries = Object.entries(sinks)

      sinkEntries.forEach((entry) => {
        const [sink, reducer] = entry

        const isStateSink = (sink == this.stateSourceName)

        const on = isStateSink ? onState : onNormal
        const onned = on(action, reducer)

        const wrapped = onned.compose(this.log(data => {
            if (isStateSink) {
              return `State reducer added: <${ type }>`
            } else {
              const extra = data && (data.type || data.command || data.name || data.key || (Array.isArray(data) && 'Array') || data)
              return `Data sent to [${ driver }]: <${ type }> ${ extra }`
            }
          }))

        if (Array.isArray(reducers[sink])) {
          reducers[sink].push(wrapped)
        } else {
          reducers[sink] = [wrapped]
        }
      })
    })

    const model$ = Object.entries(reducers).reduce((acc, entry) => {
      const [sink, streams] = entry
      acc[sink] = xs.merge(xs.never(), ...streams)
      return acc
    }, {})

    this.model$ = model$
  }

  initSendResponse$() {
    const responseType = typeof this.response
    if (responseType != 'function' && responseType != 'undefined') {
      throw new Error('The response parameter must be a function')
    }

    if (responseType == 'undefined') {
      if (this.response$) {
        this.response$.subscribe({
          next: this.log(({ _reqId, _action }) => `Unhandled response for request: ${ _action } ${ _reqId }`)
        })
      }
      this.sendResponse$ = xs.never()
      return
    }

    const selectable = {
      select: (actions) => {
        if (typeof actions == 'undefined') return this.response$
        if (!Array.isArray(actions)) actions = [actions]
        return this.response$.filter(({_action}) => (actions.length > 0) ? (_action === 'FUNCTION' || actions.includes(_action)) : true)
      }
    }

    const out = this.response(selectable)
    if (typeof out != 'object') {
      throw new Error('The response function must return an object')
    }

    const entries = Object.entries(out)
    const out$    = entries.reduce((acc, [command, response$]) => {
      const mapped$ = response$.map(({ _reqId, _action, data }) => {
        if (!_reqId) {
          throw new Error(`No request id found for response for: ${ command }`)
        }
        return { _reqId, _action, command, data }
      })
      return [ ...acc, mapped$ ]
    }, [])

    this.sendResponse$ = xs.merge(...out$)
      .compose(this.log(({ _reqId, _action }) => `[${ this.requestSourceName }] response sent for: <${ _action }>`))
  }

  initChildren$() {
    const initial = this.sourceNames.reduce((acc, name) => {
      if (name == this.DOMSourceName) {
        acc[name] = {}
      } else {
        acc[name] = []
      }
      return acc
    }, {})

    this.children$ = Object.entries(this.children).reduce((acc, [childName, childFactory]) => {
      const child$ = childFactory(this.sources)
      this.sourceNames.forEach(source => {
        if (source == this.DOMSourceName) {
          acc[source][childName] = child$[source]
        } else {
          acc[source].push(child$[source])
        }
      })
      return acc
    }, initial)
  }

  initVdom$() {
    if (typeof this.view != 'function') {
      this.vdom$ = xs.of(null)
      return
    }

    const state        = (this.sources[this.stateSourceName] && this.sources[this.stateSourceName].stream) || xs.never()
    const renderParams = { ...this.children$[this.DOMSourceName] }

    renderParams[this.stateSourceName] = state

    const pulled = Object.entries(renderParams).reduce((acc, [name, stream]) => {
      acc.names.push(name)
      acc.streams.push(stream)
      return acc
    }, {names: [], streams: []})

    const merged = xs.combine(...pulled.streams)
      .compose(debounce(1))
      .map(arr => {
        return pulled.names.reduce((acc, name, index) => {
          acc[name] = arr[index]
          return acc
        }, {})
      })

    this.vdom$ = merged.map(this.view).remember().compose(this.log('View Rendered'))
  }

  initSinks() {
    this.sinks = this.sourceNames.reduce((acc, name) => {
      if (name == this.DOMSourceName) return acc
      acc[name] = xs.merge((this.model$[name] || xs.never()), ...this.children$[name])
      return acc
    }, {})

    this.sinks[this.DOMSourceName]     = this.vdom$
    this.sinks[this.requestSourceName] = xs.merge(this.sendResponse$ ,this.sinks[this.requestSourceName])
  }

  makeOnAction(action$, isStateSink=true, rootAction$) {
    rootAction$ = rootAction$ || action$
    return (name, reducer) => {
      const filtered$ = action$.filter(({type}) => type == name)

      let returnStream$
      if (typeof reducer === 'function') {
        returnStream$ = filtered$.map(action => {
          const next = (type, data) => {
            const _reqId = action._reqId || (action.req && action.req.id)
            const _data  = _reqId ? (typeof data == 'object' ? { ...data, _reqId, _action: name } : { data, _reqId, _action: name }) : data
            // put the "next" action request at the end of the event loop so the "current" action completes first
            setTimeout(() => {
              // push the "next" action request into the action$ stream
              rootAction$.shamefullySendNext({ type, data: _data })
            }, 10)
          }
          if (isStateSink) {
            return (state) => {
              const newState = reducer(state, action.data, next, action.req)
              if (newState == ABORT) return state
              return newState
            }
          } else {
            const reduced = reducer(this.currentState, action.data, next, action.req)
            const type = typeof reduced
            const _reqId = action._reqId || (action.req && action.req.id)
            if (['string', 'number', 'function'].includes(type)) return reduced
            if (type == 'object') return { ...reduced, _reqId, _action: name }
            throw new Error('Invalid reducer type for', name, type)
          }
        }).filter(result => result != ABORT)
      } else if (reducer === undefined || reducer === true) {
        returnStream$ = filtered$.map(({data}) => data)
      } else {
        const value = reducer
        returnStream$ = filtered$.mapTo(value)
      }

      return returnStream$
    }
  }

}




/**
 * instantiate a cycle collection and isolate
 * (makes the code for doing isolated collections more readable)
 *
 * @param {Object} collectionOpts options for the makeCollection function (see cycle/state documentation)
 * @param {String|Object} isolateOpts options for the isolate function (see cycle/isolate documentation)
 * @param {Object} sources object of cycle style sources to use for the created collection
 * @return {Object} collection of component sinks
 */
function makeIsolatedCollection (collectionOpts, isolateOpts, sources) {
  return isolate(makeCollection(collectionOpts), isolateOpts)(sources)
}

export function collectionOf(component, stateLense, combineList=['DOM'], globalList=['EVENTS'], stateSourceName='STATE') {
  return (sources) => {
    const collectionOpts = {
      item:         component,
      itemKey:      state => state.id,
      itemScope:    key => key,
      channel:      stateSourceName,
      collectSinks: instances => {
        return Object.entries(sources).reduce((acc, [name, stream]) => {
          acc[name] = instances[(combineList.includes(name) ? 'pickCombine' : 'pickMerge')](name)
          return acc
        }, {})
      }
    }

    const isolateOpts = {[stateSourceName]: stateLense}

    globalList.forEach(global => isolateOpts[global] = null)

    return makeIsolatedCollection(collectionOpts, isolateOpts, sources)
  }
}