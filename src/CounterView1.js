import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'

class CounterView1 extends Component {
  render () {
    console.log('......CounterView1 props:', this.props)

    return (
      <div style={{
        backgroundColor: '#00ff00',
        width: 300,
        height: 100
      }}>
        <h1 className="App-title">CounterView 1: {this.props.demoData.counter}</h1>
      </div>
    )
  }
}

const mapStateToProps = (state) => {
  // 拷贝demo_1以避免直接修改store
  let demo_1 = Object.assign({}, state.demo_1)
  if (!demo_1.counter) {
    demo_1.counter = 0
  }
  // 考虑到实际应用场景的复杂性，可能还存在demoData_1, demoData_2 ...，故在此做了一层封装
  return { demoData: demo_1 }
} 

const mapDispatchToPeops = (dispatch) => {
  return bindActionCreators({}, dispatch)
}

export default connect(mapStateToProps, mapDispatchToPeops)(CounterView1)
