import React, { Component } from 'react'
import { createAction } from 'redux-actions'

import * as actionTypes from './constants'

import CounterView1 from './CounterView1'
import CounterView2 from './CounterView2'
import { getStore } from './store/reducers'

class App extends Component {
  buttonEvent_1() {
    let store = getStore()
    if (!store) {
      console.log('buttonEvent_1')
      return
    }
    store.dispatch(createAction(actionTypes.DEMO_ACTION_1)({}))
  }

  buttonEvent_2() {
    let store = getStore()
    if (!store) {
      console.log('buttonEvent_2')
      return
    }
    store.dispatch(createAction(actionTypes.DEMO_ACTION_2)({}))
  }

  render() {
    console.log('......App props:', this.props)
    return (
      <div style={{ marginTop: 20, marginLeft: 20 }}>
        <button onClick={() => this.buttonEvent_1()}>
          Button 1
        </button>
        <button
          onClick={() => this.buttonEvent_2()}
          style={{ marginLeft: 20 }}
        >
          Button 2
        </button>
        <CounterView1 />
        <CounterView2 />
      </div>
    )
  }


}

export default App;