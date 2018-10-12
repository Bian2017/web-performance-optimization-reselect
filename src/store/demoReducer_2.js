import * as actionTypes from './constants'

export default function reducer(state = { counter: 0 }, action) {
  switch (action.type) {
    case actionTypes.DEMO_ACTION_2:
      return handleDemoAction2(state, action)

    default:
      return state
  }
}

function handleDemoAction2(state, action) {
  let counter = state.counter || 0
  state = Object.assign({}, state, { counter: counter + 1 })
  return state
}