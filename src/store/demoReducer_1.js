import * as actionTypes from '../constants'

export default function reducer (state = {}, action) {
  switch (action.type) {
    case actionTypes.DEMO_ACTION_1:
      return handleDemoAction1(state, action)

    default:
      return state
  }
}

function handleDemoAction1 (state, action) {
  let counter = state.counter || 0
  state = Object.assign({}, state, { counter: counter + 1 })
  return state
}