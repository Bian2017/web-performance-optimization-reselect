import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'

class CounterView2 extends Component {
  render() {
    console.log('......组件B props:', this.props)

    return (
      <div style={{
        backgroundColor: '#ff0000',
        width: 300,
        height: 100
      }}>
        <h1 className="App-title">组件 B: {this.props.demoData.counter}</h1>
      </div>
    )
  }
}

const mapStateToProps = (state) => {
  let demo_B = state.demo_B
  if (!demo_B.counter) {
    demo_B = { counter: 0 }
  }
  return { demoData: demo_B }
}

const mapDispatchToPeops = (dispatch) => {
  return bindActionCreators({}, dispatch)
}

export default connect(mapStateToProps, mapDispatchToPeops)(CounterView2)