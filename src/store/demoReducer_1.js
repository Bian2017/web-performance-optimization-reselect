import * as actionTypes from './constants'

export default function reducer(state = {}, action) {
  switch (action.type) {
    case actionTypes.DEMO_ACTION_A:
      return handleDemoActionA(state, action)
    default:
      return state
  }
}

function handleDemoActionA(state, action) {
  let counter = state.counter || 0
  state = Object.assign({}, state, { counter: counter + 1 })
  return state
}