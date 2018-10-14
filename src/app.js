import React, { Component } from 'react'
import { createAction } from 'redux-actions'
import { connect } from 'react-redux'
import * as actionTypes from './store/constants'
import CounterView1 from './CounterView1'
import CounterView2 from './CounterView2'

class App extends Component {
  buttonEvent_1() {
    const { store, dispatch } = this.props
    if (!store) {
      console.log('buttonEvent_1')
      return
    }

    dispatch(createAction(actionTypes.DEMO_ACTION_A)({}))
  }

  buttonEvent_2() {
    const { store, dispatch } = this.props
    if (!store) {
      console.log('buttonEvent_2')
      return
    }
    
    dispatch(createAction(actionTypes.DEMO_ACTION_B)({}))
  }

  render() {
    console.log('......App props:', this.props)

    return (
      <div style={{ marginTop: 20, marginLeft: 20 }}>
        <button onClick={() => this.buttonEvent_1()}>
          Button A
        </button>
        <button
          onClick={() => this.buttonEvent_2()}
          style={{ marginLeft: 20 }}
        >
          Button B
        </button>
        <CounterView1 otherProps={{a: 1}} />
        <CounterView2 />
      </div>
    )
  }
}

const mapStateToProps = (state) => {
  return {
    store: state
  }
}

export default connect(mapStateToProps)(App);