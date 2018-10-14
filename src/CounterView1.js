import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'

class CounterView1 extends Component {
  componentWillReceiveProps(nextProps) {
    console.log('........组件A', nextProps.otherProps === this.props.otherProps)
  }

  render() {
    console.log('......组件A props:', this.props)

    return (
      <div style={{
        backgroundColor: '#00ff00',
        width: 300,
        height: 100
      }}>
        <h1 className="App-title">组件 A: {this.props.demoData.counter}</h1>
      </div>
    )
  }
}

const DefaultDemoData = { counter: 0 }
// 缓存上次运算的结果
let lastCounter, lastResult

const tonsOfCalculation = (counter) => {
  if (lastCounter !== undefined && lastResult !== undefined && lastCounter === counter) {
    // 参数未变，返回上次结果
    return lastResult
  }

  lastCounter = counter
  for (let i = 1; i < 5; i++) {
    counter *= i
  }
  lastResult = counter
  return counter
}

const mapStateToProps = (state) => {
  let demo_A = state.demo_A
  if (!demo_A.counter) {
    demo_A = DefaultDemoData
  }
  demo_A.counter = tonsOfCalculation(demo_A.counter)

  // 考虑到实际应用场景的复杂性，可能还存在demoData_1, demoData_2 ...，故在此做了一层封装
  return { demoData: demo_A }
}

const mapDispatchToPeops = (dispatch) => {
  return bindActionCreators({}, dispatch)
}

export default connect(mapStateToProps, mapDispatchToPeops)(CounterView1)
