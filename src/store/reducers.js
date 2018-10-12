import demo1Reducer from './demoReducer_1'
import demo2Reducer from './demoReducer_2'
import { createStore, combineReducers } from 'redux'

const reducer = combineReducers({
  demo_1: demo1Reducer,
  demo_2: demo2Reducer
})

export const getStore = () => {
  return createStore(reducer)
}