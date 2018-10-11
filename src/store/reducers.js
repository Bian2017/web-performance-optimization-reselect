import { reducer as demo1Reducer } from './demoReducer_1'
import { reducer as demo2Reducer } from './demoReducer_2'
import { combineReducers } from 'redux'

const reducer = combineReducers({
  demo_1: demo1Reducer,
  demo_2: demo2Reducer
})

export const getStore = () => {
  return createStore(reducer)
}