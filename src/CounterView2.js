import React, { Component } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'

class CounterView2 extends Component {
  render() {
    console.log('......CounterView2 props:', this.props)

    return (
      <div style={{
        backgroundColor: '#ff0000',
        width: 300,
        height: 100
      }}>
        <h1 className="App-title">CounterView 2: {this.props.demoData.counter}</h1>
      </div>
    )
  }
}

const mapStateToProps = (state) => {
  let demo_2 = Object.assign({}, state.demo_2)
  if (!demo_2.counter) {
    demo_2.counter = 0
  }
  return { demoData: demo_2 }
}

const mapDispatchToPeops = (dispatch) => {
  return bindActionCreators({}, dispatch)
}

export default connect(mapStateToProps, mapDispatchToPeops)(CounterView2)