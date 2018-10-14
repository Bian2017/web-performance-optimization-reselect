Reselect库

---

本文非原创，绝大部分参照[关于react, redux, react-redux和reselect的一些思考](https://zhuanlan.zhihu.com/p/33985606)文章来进行工程化实践。

## 一、搭建环境

项目实践初始化代码，见分支[daily/0.0.1](https://github.com/Bian2017/web-performance-optimization-reselect/tree/daily/0.0.1)。

1. 安装依赖

> npm install

2. 代码编译

> npm run dev

3. 在浏览器打开public目录下的index.html。

## 二、遇到的问题

### 1. 场景描述

界面如下：

![](https://raw.githubusercontent.com/Bian2017/web-performance-optimization-reselect/daily/0.0.1/docs/img/problem.png)

其中，demo_A、demoe_B为reducer key。组件A，组件B通过connect分别显示demo_A、demo_B中的counter值；当点击Button A和Button B时，分别通过DEMO_ACTION_A和DEMO_ACTION_B来更新demo_A、demo_B中的counter值。

### 2.期望结果

当点击Button A时，demo_A中counter值加一，组件 A重新渲染以显示最新的counter值，组件 B不重新渲染（因为demo_B中的counter值没有改变）；反之亦然。

### 3. 实际结果

运行上述代码，当点击Button A时，组件A显示最新的counter值，组件B显示的值不变，符合预期；但是通过控制台输出发现，组件A和组件B都重新渲染了，与预期相矛盾，如下图所示：

![](https://raw.githubusercontent.com/Bian2017/web-performance-optimization-reselect/daily/0.0.1/docs/img/stillRender.png)

## 三、思考：为什么store中不相关的数据的改变会引起界面的重新渲染？

### 1. 简单回顾一下Redux相关知识

redux中有三个核心元素：store、reducer和action。其中store作为应用的唯一数据源，用于存储应用在某一时刻的状态数据；store是只读的，且只能通过action来改变，即通过action将状态1下的store转换为状态2下的store；reducer用于定义状态转换的具体细节，并与action相对应；应用的UI部分可以通过store提供的**subscribe方法来监听store的改变**，当状态1下的store转换为状态2下的store时，所有通过subscribe方法注册的监听器(listener)都会被调用。

### 2. connect返回的是一个监听store改变的HOC

*注意：本文中所有react-redux源码片段均来自react-redux@4.4.6，下文中将不再重复强调。*

下面是react-redux的connect函数部分源码：

```JS
export default function connect(mapStateToProps, mapDispatchToProps, mergeProps, options = {}) {
  // ...
  return function wrapWithConnect(WrappedComponent) {
    // ...
    class Connect extends Component {
      // ...
      trySubscribe() {
        if (shouldSubscribe && !this.unsubscribe) {
          this.unsubscribe = this.store.subscribe(this.handleChange.bind(this))
          this.handleChange()
        }
      }

      tryUnsubscribe() {
        if (this.unsubscribe) {
          this.unsubscribe()
          this.unsubscribe = null
        }
      }

      componentDidMount() {
        this.trySubscribe()
      }

      componentWillUnmount() {
        this.tryUnsubscribe()
        // ...
      }

      handleChange() {
        if (!this.unsubscribe) { return }

        const storeState = this.store.getState()
        const prevStoreState = this.state.storeState
        if (pure && prevStoreState === storeState) {
          return
        }
        if (pure && !this.doStatePropsDependOnOwnProps) {
          // ...
        }

        this.hasStoreStateChanged = true
        this.setState({ storeState })        // 设置setState导致重新渲染Connect HOC
      }
      // ...
    }

    render() {
      const { renderedElement } = this

      // haveMergedPropsChanged = false 且renderedElement存在时，会返回已存在的renderedElement，此时WrappedComponent不会被重新渲染。 
      if (!haveMergedPropsChanged && renderedElement) {
        return renderedElement
      }

      // 创建新的renderedElement并返回
      if (withRef) {
        this.renderedElement = createElement(WrappedComponent, {
          ...this.mergedProps,
          ref: 'wrappedInstance'
        })
      } else {
        this.renderedElement = createElement(WrappedComponent,
          this.mergedProps
        )
      }
      return this.renderedElement
    }

    // ...
    return hoistStatics(Connect, WrappedComponent)
  }
  // ...
}
```

通过这部分源码可知，Connect HOC在componentDidMount中通过store的subscribe方法来监听了store的改变，在handleChange回调中，首先判断store是否改变，如果store改变，通过setState方法来重新渲染Connect HOC。

注意，在Connect HOC的render方法中，当haveMergedPropsChanged = false且renderedElement存在时，会返回已存在的renderedElement，此时WrappedComponent不会被重新渲染；否则会创建新的renderedElement并返回，此时会导致WrappedComponent重新渲染。

### 3. 参数mergeProps作用

connect方法接收四个参数mapStateToProps、mapDispatchToProps、mergeProps和options，我们最熟悉、使用最多的是前两个参数，当需要拿到WrappedComponent的引用时，我们会使用第四个参数options中的withRef属性，{ withRef: true }。对于第三个参数mergeProps接触得比较少(至少在我做过的项目中接触得比较少)，在解释mergeProps之前，需要知道Connect HOC主要处理哪几部分数据。

Connect HOC主要处理三种类型的数据：stateProps、dispatchProps和ownProps。其中stateProps由mapStateToProps计算得到，dispatchProps由mapDispatchToProps计算得到，ownProps是**父控件传递给Connect HOC的**。

根据react-redux文档，mergeProps的定义是：

```JS
[mergeProps(stateProps, dispatchProps, ownProps): props] (Function)
```

mergeProps将stateProps、dispatchProps和ownProps作为参数，并返回一个props，这个props暨是最终传递给WrappedComponent的props。如果没有为connect指定mergeProps，则默认使用Object.assign({}, ownProps, stateProps, dispatchProps)。在使用默认值的情况下，如果stateProps和ownProps中存在同名属性，stateProps中的对应值会覆盖ownProps中的值(注：stateProps中的属性会覆盖父组件传递给子组件的同名属性)。

下面给出几个mergeProps的使用场景：

```JS
/*
 * 当stateProps和dispatchProps的内部属性过多时(尤其是dispatchProps),
 * 默认情况下，mergeProps会依次将这些属性复制到WrappedComponent的props中，
 * 从而导致WrappedComponent的props过大，增大调试的复杂度。
 * 
 * mergeProps的这种实现可以有效地避免上述问题。
 */ 
function mergeProps (stateProps, dispatchProps, ownProps) {
  return {
    stateProps, dispatchProps, ownProps
  }
}

/*
 * 现假设有一个文章列表，列表中的任意一篇文章都含有id, abstract, creator等
 * 信息。又因为某些原因，这些信息只存在于Component的state中，而没存到store中(
 * 在Component中直接调接口，并将结果以setState方式保存)。当进入某篇文章详情时，
 * 已存在于客户端的数据应立即展示出来，如creator。为达到这一目的，需要通过ownProps
 * 来传递这些数据。
 * 
 * 在文章详情页面，会请求文章的详细数据，并存储到store中，然后通过mapStateToProps
 * 从store获取文章相关数据。当接口返回之前，通常会使用一些默认值来替代真实值。因此，
 * stateProps.creator可能是是默认值{id: undefined, avatar: undefined, ...}。
 * 
 * 又因为mergeProps在默认情况下，ownProps中同名属性会被stateProps中的值覆盖，暨
 * 最终从WrappedComponent的props中取得的creator是未初始化的默认状态，也就不能在
 * 进入文章详情后马上显示creator相关信息，即使文章列表中已存在相关的数据。
 * 
 * 利用mergeProps可以在一定程度上解决这个问题，下面是示例代码。
 */
function mergeProps (stateProps, dispatchProps, ownProps) {
  if (stateProps.creator && ownProps.creator) {
    if (!stateProps.creator.id) {
      delete stateProps.creator
    }
  }
  return Object.assign({}, ownProps, stateProps, dispatchProps)
}

/*
 * 完全丢弃stateProps，dispatchProps和ownProps，并返回其他对象
 */
function mergeProps (stateProps, dispatchProps, ownProps) {
  return { a: 1, b: 2, ... }
}
```

> 注：要避免Redux中的state覆盖子组件的props(来自父组件)，可以通过connect的第三参数mergeProps来避免上述情况发生。

### 4. WrappedComponent在什么情况下会被重新渲染？

由上述Connect HOC的render方法的片段可知，当haveMergedPropsChanged = true或renderedElement不存在时，WrappedComponent会重新渲染。其中renderedElement是对上一次调用createElement的结果的缓存，除第一次执行Connect HOC的render方法外，createElement一直有值(不考虑出错情况)。因此**WrappedComponent是否重新渲染由haveMergedPropsChanged的值决定**，即mergedProps是否改变。mergedProps改变，WrappedComponent重新渲染；反之则不重新渲染。

> 注：mergedProps改变会引起WrappedComponent重新渲染。

下面是Connect HOC的render方法中的部分逻辑：

```JS
render () {
  const {
    // ...
    renderedElement
  } = this

  // ...
  let haveStatePropsChanged = false
  let haveDispatchPropsChanged = false
  haveStatePropsChanged = this.updateStatePropsIfNeeded()
  haveDispatchPropsChanged = this.updateDispatchPropsIfNeeded()

  let haveMergedPropsChanged = true

  // 当stateProps，dispatchProps和ownProps三者中任意一者改变时，便会去检测mergedProps是否改变。
  if (
    haveStatePropsChanged ||
    haveDispatchPropsChanged ||
    haveOwnPropsChanged
  ) {
    haveMergedPropsChanged = this.updateMergedPropsIfNeeded()
  } else {
    haveMergedPropsChanged = false
  }

  if (!haveMergedPropsChanged && renderedElement) {
    return renderedElement
  }

  if (withRef) {
    // ...
  } else {
    // ...
  }
}
```

上述代码中，当stateProps、dispatchProps和ownProps三者中任意一者改变时，便会去检测mergedProps是否改变。

```JS
// 检查mergeProps是否改变
updateMergedPropsIfNeeded() {
  const nextMergedProps = computeMergedProps(this.stateProps, this.dispatchProps, this.props)
  if (this.mergedProps && checkMergedEquals && shallowEqual(nextMergedProps, this.mergedProps)) {
    return false
  }

  this.mergedProps = nextMergedProps
  return true
}
```

当mergeProps为默认值时，通过简单的推导可知，stateProps、dispatchProps和ownProps三者中任意一者改变时，mergedProps也会改变，从而导致WrappedComponent的重新渲染。

### 5. 如何判断ownProps是否改变？

在Connect HOC中，在componentWillReceiveProps中判断ownProps是否改变，代码如下：

```JS
componentWillReceiveProps(nextProps) {
  if (!pure || !shallowEqual(nextProps, this.props)) {
    this.haveOwnPropsChanged = true
  }
}
```

> 注意：是在Connect高阶函数中判断ownProps(父组件传递的props)是否改变，不是在WrappedComponent组件中进行判断。

其中pure为一可选配置，其值取自connect的第四个参数options，默认为true(关于pure的更多细节，请自行阅读react-redux源码，这里不做过多讨论)。

```JS
const { pure = true, withRef = false } = options
```

若pure为默认值，当父控件传递给Connect HOC的props改变时，ownProps改变。

### 6. 如何判断stateProps和dispatchProps是否改变？以stateProps为例

Connect HOC通过在render中调用updateStatePropsIfNeeded方法来判断stateProps是否改变：

```JS
updateStatePropsIfNeeded() {
  const nextStateProps = this.computeStateProps(this.store, this.props)
  if (this.stateProps && shallowEqual(nextStateProps, this.stateProps)) {
    return false
  }

  this.stateProps = nextStateProps
  return true
}

computeStateProps(store, props) {
  if (!this.finalMapStateToProps) {
    return this.configureFinalMapState(store, props)
  }

  const state = store.getState()
  const stateProps = this.doStatePropsDependOnOwnProps ?
    this.finalMapStateToProps(state, props) :
    this.finalMapStateToProps(state)

  if (process.env.NODE_ENV !== 'production') {
    checkStateShape(stateProps, 'mapStateToProps')
  }
  return stateProps
}
```

由此可知，Connect HOC是通过对this.stateProps和nextStateProps的shallowEqual(浅比较)来判断stateProps是否改变的。dispatchProps与stateProps类似，不再重复讨论。

### 7. 回答问题：为什么store中不相关的数据的改变会引起界面的重新渲染？

首先我们再看一下上述例子中mapStateToProps的实现:

```JS
const mapStateToProps = (state) => {
  let demo_A = Object.assign({}, state.demo_A)
  if (!demo_A.counter) {
    demo_A.counter = 0
  }
  return { demoData: demo_A }
} 
```

注意这一句let demo_A = Object.assign({}, state.demo_A)，每次调用mapStateToProps，都会创建一个新的Object实例并赋值给demo_A。当连续调用两次mapStateToProps，则有：

```JS
let thisStateProps = mapStateToProps(state)
let nextStateProps = mapStateToProps(state)
assert(thisStateProps.demoData !== nextStateProps.demoData)
```

在updateStatePropsIfNeeded中，会将nextStateProps和thisStateProps做shallowEqual，因为thisStateProps.demoData !== nextStateProps.demoData，updateStatePropsIfNeeded会返回true，stateProps改变。

综上所叙，当点击Button B时，会dispatch出DEMO_ACTION_B并改变store。组件A的Connect HOC的handleChange回调检测到store改变，并通过setState的方式让Connect HOC重新渲染。在Connect HOC的render方法中，因为this.stateProps.demoData !== nextStateProps.demoData，this.updateStatePropsIfNeeded返回true，表示stateProps发生了改变。又由我们在第四小点“WrappedComponent在什么情况下会被重新渲染？”中得出的结论可知，当stateProps改变时，组件A会被重新渲染

> 注：组件B的值发生变化，引起整个store发生变化。connect高阶组件监测到store变化，调用组件A的mapStateToProps，此时该函数会重新生成一个Object实例，connect高阶组件通过浅比较函数认为前后两个Object实例不等(引用地址不等)，从而重新渲染组价A。

## 四、再思考：我们该如何写mapStateToProps？

从上述分析可知，当点击Button B时，组件A之所以会被重新渲染，是因为每次调用mapStateToProps时，都会创建新的Object实例并赋给demo_A，这导致了updateStatePropsIfNeeded中的shallowEqual失败(对象引用地址不同)，stateProps改变，组件A重新渲染。

### 1. 优化上述mapStateToProps写法

先看下面这段代码：

```JS
let obj = { p1: { a: 1 }, p2: { b: 2 } }
let obj2 = Object.assign({}, obj, { p3: { c: 3 } })
assert(obj.p1 === obj2.p1)          // 输出值为true
```

由此可知，当DEMO_ACTION_B改变了store之后，有thisStore !== nextStore, 但是thisStore.demo_A === nextStore.demo_A，store中demo_A所指向的对象并没有发生改变。在上述mapStateToProps的实现中，最大的问题是每次调用mapStateToProps时，stateProps.demoData都会指向新的对象。如果直接将store.demo_A直接赋给stateProps.demoData呢？修改后的代码如下：

```JS
const mapStateToProps = (state) => {
  let demo_A = state.demo_A
  if (!demo_A.counter) {
    demo_A = { counter: 0 }
  }
  return { demoData: demo_A }
}
```

执行修改后代码(详见[daily/0.0.3](https://github.com/Bian2017/web-performance-optimization-reselect/commit/d66e64fa30de1d1dbc861809e1c1653995412464))，控制台输出如下：

![](https://raw.githubusercontent.com/Bian2017/web-performance-optimization-reselect/master/docs/img/fixA.png)

由该控制台日志可知，当第一次点击Button A时，组件A和组件B都重新渲染了；随后点击Button B时，只有组件B重新渲染了，为什么？

分析优化后的mapStateToProps可知，当第一次点击Button A时，store.demo_B是初始化时的默认值，因此会进入if (!demo_B.counter) { demo_B = { counter: 0 } }这一逻辑分支，在mapStateToProps中，我们每次都创建了新的默认值。再次优化mapStateToProps如下：

```JS
const DefaultDemoData = { counter: 0 }
const mapStateToProps = (state) => {
  let demo_A = state.demo_A
  if (!demo_A.counter) {
    demo_A = DefaultDemoData
  }
  return { demoData: demo_A }
}
```

当点击Button A或Button B时，均只有对应的组件被重新渲染。

### 2. 尝试归纳一些基本原则

+ 不要在mapStateToProps构建**新的对象**，直接使用store中对应的对象；
+ 提供全局的默认值，以使每次返回的默认值都指向同一个对象

使用immutable时的一个常见的错误写法：

```JS
let immutableRecord = state['reducer_key'].immutableRecord || DefaultImmutableRecord
immutableRecord = immutableRecord.toJS()
```

每次调用toJS()方法时，都会生成新的对象，从而导致stateProps的改变，重新渲染界面。

### 3. 我们无法避免在mapStateToProps中构建新的对象

现假设有如下store结构，为了方便操作，此处会使用immutable：

```JS
new Map({
  feedIdList_1: new List([id_1, id_2, id_3]),
  feedIdList_2: new List([id_1, id_4, id_5]),
  feedById: new Map({
    id_1: FeedRecord_1,
    ...
    id_5: FeedRecord_5
  })
})
```

为了在界面上渲染一个feed列表，例如feedIdList_1，我们会将这个feed列表connect到store上，然后在mapStateToProps中构建出一个feed数组，数组中的每个元素对应一条feed，mapStateToProps部分代码如下：

```JS
const DefaultList = new List()
const mapStateToProps = (state, ownProps) => {
  let feedIdList = state['reducer_key'].feedIdList_1 || DefaultList
  // 因react无法渲染immutable list，故需要转换为数组
  feedIdList = feedIdList.toJS()

  let feedList = feedIdList.map((feedId) => {
    return state['reducer_key'].getIn(['feedById', feedId])
  })

  return {
    feedList: feedList,
    // other data
  }
}
```

> 注：react无法渲染immutable list，故需要转换为数组。 

在上述mapStateToProps的实现中，每次调用mapStateToProps都会创建一个新的feedList对象，由上述的讨论可知，即使feedIdList_1和id_1, id_2, id_3对应的FeedRecord都没有改变，当store其他部分改变时，也会引起该feed列表的重新渲染。

*注意：当需要在界面上渲染一个列表时，我们一般会选择将这个列表connect到store上，而不是将列表的每个元素分别connect到store上，更多关于在什么地方使用connect，请参考[redux/issues/815](https://github.com/reduxjs/redux/issues/815), [redux/issues/1255](https://github.com/reduxjs/redux/issues/1255)和[At what nesting level should components read entities from Stores in Flux?](https://stackoverflow.com/questions/25701168/at-what-nesting-level-should-components-read-entities-from-stores-in-flux/25701169#25701169)*

## 五、再再思考：我们该如何避免由store中无关数据的改变引起的重新渲染？

### 1. shouldComponentUpdate

首先我们会想到利用shouldComponentUpdate，通过比较this.state，this.props和nextState，nextProps，判断state和props都是否改变(使用deepEqual，shallowEqual或其他方法)，从而决定界面是否重新渲染。

虽然利用shouldComponentUpdate可以避免由store中无关数据的改变引起的重新渲染，但每次store改变时，所有的mapStateToProps都会被重新执行，这可能会导致一些性能上的问题。

> mapStateToProps每次都重新执行，也会导致性能问题。

### 2. 一个极端的例子

```JS
const DefaultDemoData = { counter: 0 }
const mapStateToProps = (state, ownProps) => {
  let demo_A = state.demo_A
  if (!demo_A.counter) {
    demo_A = DefaultDemoData
  }

  // tons of calculation here, for example:
  let counter = demo_A.counter
  for (let i = 0, i < 1000000000000; i++) {
    counter *= i
  }
  demo_A.counter = counter

  return { demoData: demo_A }
}
```

在这个极端的例子中，mapStateToProps有一段非常耗时的计算。虽然shouldComponentUpdate可以有效地避免重新渲染，我们该如何有效地避免这段复杂的计算呢？

### 3. 一个新的想法

redux充分利用了纯函数的思想，我们的mapStateToProps其本身也是一个纯函数。纯函数的特点是当输入不变时，多次执行同一个纯函数，其返回结果不变。既然在demo_A.counter的值未改变的情况下，每次执行完这段耗时操作的返回值都相同，我们能不能将这个结果缓存起来，当demo_A.counter没有发生改变时，直接去读取这个缓存值呢？修改上述代码如下：

```JS
const DefaultDemoData = { counter: 0 }
// 缓存上次运算的结果
let lastCounter, lastResult

const tonsOfCalculation = (counter) => {
  if (lastCounter !== undefined && lastResult !== undefined && lastCounter === counter) {
    // 参数未变，返回上次结果
    return lastResult
  }

  lastCounter = counter
  for (let i = 0; i < 1000000000; i++) {
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

  return { demoData: demo_A }
}
```

在tonsOfCalculation中，我们通过记录传入的counter值并将其与当前传入的counter做比较来判断输入是否改变，当counter改变时，重新计算并缓存结果；当counter不变且缓存值存在时，直接读取缓存值，从而有效地避免了不必要的耗时计算，详见[代码修改](https://github.com/Bian2017/web-performance-optimization-reselect/commit/e60be6972a8aa7724018ec8e4625a9eb66f942f8)。