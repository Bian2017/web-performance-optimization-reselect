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

> mapStateToProps每次都重新执行，也会导致性能问题。

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

### 4. 将缓存的思想应用到mapStateToProps中

借助缓存的思想，我们需要达到两个目的:

+ 当store中相关依赖数据没有发生改变时，直接从缓存中读取上一次构建的对象，避免重新渲染。例：当feedIdList_1和id_1, id_2, id_3对应的FeedRecord都没有改变，直接从缓存中读取feedList，避免构建新的对象；
+ 避免mapStateToProps中可能存在的耗时操作。例：当counter未改变时，直接读取缓存值；

store中相关依赖数据：即mapStateToProps/selector为达到其特定的计算目的而需要从store中读取的数据，以我们的feedList_1为例，相关依赖数据分别是feedIdList_1，feedById.id_1，feedById.id_2和feedById.id_3。

修改上述feed列表例子的代码如下：

```JS
// LRU: Least Recently Used(最近最少使用)
const LRUMap = require('lru_map').LRUMap
const lruMap = new LRUMap(500)

const DefaultList = new List()
const DefaultFeed = new FeedRecord()

const mapStateToProps = (state, ownProps) => {
  const hash = 'mapStateToProps'
  let feedIdList = memoizeFeedIdListByKey(state, lruMap, 'feedIdList_1')
  let hasChanged = feedIdList.hasChanged
  if (!hasChanged) {
    hasChanged = feedIdList.result.some((feedId) => {
      return memoizeFeedById(state, lruMap, feed).hasChanged
    })
  }

  if (!hasChanged && lruMap.has(hash)) {
    return lruMap.get(hash)
  }

  let feedIds = feedIdList.result.toJS()
  let feedList = feedIds((feedId) => {
    return memoizeFeedById(state, lruMap, feed).result
  })
  // do some other time consuming calculations here
  let result = {
    feedList: feedList,
    // other data
  }
  lruMap.set(hash, result)
  return result
}

function memoizeFeedIdListByKey (state, lruMap, idListKey) {
  const hash = `hasFeedIdListChanged:${idListKey}`
  let cached = lruMap.get(hash)
  let feedIds = state['reducerKey'][idListKey]
  let hasChanged = feedIds && cached !== feedIds
  if (hasChanged) {
    lruMap.set(hash, feedIds)
  }
  return { hasChanged: hasChanged, result: feedIds || DefaultList }
}

function memoizeFeedById (state, lruMap, feedId) {
  const hash = `hasFeedChanged:${feedId}`
  let cached = lruMap.get(hash)
  let feed = state['reducer_key'].getIn(['feedById', feedId])
  let hasChanged = feed && cached !== feed
  if (hasChanged) {
    lruMap.set(hash, feed)
  }
  return { hasChanged: hasChanged, result: feed || DefaultFeed }
}
```

上述代码，首先检测相关的依赖数据是否改变(feedIdList_1和id_1, id_2, id_3对应的FeedRecord)，如果没有改变且缓存存在，直接返回缓存的数据，界面不会重新渲染；如果发生了改变，重新计算并设置缓存，界面重新渲染。

### 5. 介绍一个新的库：reselect

[reselect](https://github.com/reduxjs/reselect)利用上述思想，通过检测store中相关依赖数据是否改变，来避免mapStateToProps的重复计算，同时避免界面的不必要渲染。下面我们会着重讨论reselect的使用场景及其局限性。

### 6. 还需要在WrappedComponent中使用shouldComponentUpdate吗？

既然利用缓存的思想，可以在mapStateToProps中避免不必要的界面渲染，我们还需要在WrappedComponent中使用shouldComponentUpdate吗？前面我们有说到，connect HOC主要处理三种类型的数据stateProps，dispatchProps和ownProps，利用缓存的思想可以有效地避免由stateProps和dispatchProps引起的不必要渲染，那么当ownProps改变时会怎样呢？看下面的例子：

```JS
// src/app.js

render () {
  return (
    <div>
      <CounterView1 otherProps={{ a: 1 }}>
    </div>
  )
}
```

在CounterView1的componentWillReceiveProps中，你会发现nextProps.otherProps !== this.props.otherProps，从而导致CounterView1重新渲染。这是因为src/app.js每次重新渲染时，都会构建一个新的otherProps对象并传递给CounterView1。此时，我们可以借助shouldComponentUpdate来避免此类由ownProps引起的不必要渲染。

> 注意：父组件给子组件传递props对象时，每次都会构建一个新的对象，故会引起子组件的重新渲染。

shouldComponentUpdate还有许多其他的应用场景，但这不属于本文考虑的范畴，故不再一一列举。

## 六、reselect

reselect是基于下述三个原则来设计的：

+ selectors可以用来计算衍生数据(derived data)，从而允许Redux只存储最小的、可能的state；
+ selectors是高效的，一个selector只有在传给它的参数发生改变时，才重新计算；
+ selectors是可以组合的，它们可以被当作其他selector的输入；

在上述第二个原则中，为保证selector的高效性，需要用到前文提到的缓存思想。

*注意：以上三个原则均翻译自reselect文档，更多详情请查看[这里](https://github.com/reduxjs/reselect)*

### 1. 如何使用reselect

下面以feed列表的例子来展示如何使用reselect，部分store结构如下，为方便操作，这里使用了immutable：

```JS
{
  feed: new Map({
    feedIdList_1: new List([id_1, id_2, id_3]),
    feedIdList_2: new List([id_1, id_4, id_5]),
    feedById: new Map({
      id_1: FeedRecord_1,
      ...
      id_5: FeedRecord_5
    })
  }),
  ...
}
```

以下是部分代码实现：

```JS
import { createSelector } from 'reselect'

const getFeedById = state => state['feed'].get('feedById')
const getFeedIds = (state, idListKey) => state['feed'].get(idListKey)

const feedListSelectorCb = (feedIds, feedMap) => {
  feedIds = feedIds.toJS ? feedIds.toJS() : feedIds
  let feedList = feedIds.map((feedId) => {
    return feedMap.get(feedId)
  })
}

const feedListSelector = createSelector(getFeedIds, getFeedById, feedListSelectorCb)

const mapStateToProps = (state, ownProps) => {
  const idListKey = 'feedIdList_1'
  let feedList = feedListSelector(state, idListKey)
  return {
    feedList: feedList,
    // other data
  }
}
```

这里，我们利用reselect提供的createSelector方法，创造出了feedListSelector，并在mapStateToProps中调用feedListSelector来计算feedList。feedListSelector的相关依赖数据是feedById和feedIdList_1，当这两者中任意一个发生改变时，reselect内部机制会判断出这个改变，并调用feedListSelectorCb重新计算新的feedList。稍后我们会详细讨论reselect这一内部机制。

相比之前利用lruMap实现的feed列表，这段代码简洁了许多，但上述代码存在一个问题。

#### 1.1 上述代码存在因store中无关数据改变而导致界面重新渲染的问题

上述feedListSelector的相关依赖数据是feedById和feedIdList_1，通过观察store的结构可知，feedById中存在与feedList_1无关的数据。也就是说，为了计算出feedList_1，feedListSelector依赖了与feedList_1无关的数据，即FeedRecord_4和FeedRecord_5。当FeedRecord_5发生改变时，feedById也随之改变，导致feedListSelectorCb会被重新调用并返回一个新的feedList。由上文的讨论可知，当在mapStateToProps中创建新的对象时，会导致界面的重新渲染。

在FeedRecord_5改变前和改变后的两个feedList_1中，虽然feedList_1中的每个元素都没有发生改变，但feedList_1本身发生了改变(两个不同的对象)，最后导致界面渲染，这是典型的因store中无关数据改变而引起界面渲染的例子。

#### 1.2 一个更复杂的例子

在实际应用中，一个feed还存在创建者属性，同时creator作为一个用户，还可能存在所属组织机构等信息，部分store结构如下：

```JS
{
  feed: {
    feedIdList_1: new List([feedId_1, feedId_2, feedId_3]),
    feedIdList_2: new List([feedId_1, feedId_4, feedId_5]),
    feedById: new Map({
      feedId_1: new FeedRecord({
        id: feedId_1,
        creator: userId_1,
        ...
      }),
      ...
      feedId_5: FeedRecord_5
    })
  },
  user: {
    userIdList_1: new List([userId_2, userId_3, userId_4])
    userById: new Map({
      userId_1: new UserRecord({
        id: userId_1,
        organization: organId_1,
        ...
      }),
      ...
      userId_3: UserRecord_3
    })
  },
  organization: {
    organById: new Map({
      organId_1: new OrganRecord({
        id: organId_1,
        name: 'Facebook Inc.',
        ...
      }),
      ...
    })
  }
}
```

上述store主要由feed, user和organization三部分组成，它们分别由不同的reducer来更新其内部数据。在渲染feedList_1时，每条feed都需要展示创建者以及创建者所属组织等信息。为达到这个目的，我们的feedListSelector需要做如下更改。

```JS
import { createSelector } from 'reselect'

const getFeedById = state => state['feed'].get('feedById')
const getUserById = state => state['user'].get('userById')
const getOrganById = state => state['organization'].get('organById')
const getFeedIds = (state, idListKey) => state['feed'].get(idListKey)

const feedListSelectorCb = (feedIds, feedMap, userMap, organMap) => {
  feedIds = feedIds.toJS ? feedIds.toJS() : feedIds
  let feedList = feedIds.map((feedId) => {
    let feed = feedMap.get(feedId)
    let creator = userMap.get(feed.creator)
    let organization = organMap.get(creator.organization)

    feed = feed.set('creator', creator)
    feed = feed.setIn(['creator', 'organization'], organization)
    return feed
  })
}
const feedListSelector = createSelector(
  getFeedIds,
  getFeedById,
  getUserById,
  getOrganById
  feedListSelectorCb
)

const mapStateToProps = (state, ownProps) => {
  const idListKey = 'feedIdList_1'
  let feedList = feedListSelector(state, idListKey)
  return {
    feedList: feedList,
    // other data
  }
}
```

上述代码中，feedListSelector的相关依赖数据是feedIdList_1，feedById，userById和organById。相对于之前简单的feed列表的例子，这里多了userById和organById这两个依赖。此时会有一个有趣的现象：当我们从服务器端请求userList_1的数据并存入store中时，会导致feedList_1的重新渲染，因为userById改变了。从性能的角度考虑，这不是我们期望的结果。

#### 1.3 能否通过改变store的结构来解决上述问题呢？

出现上述问题的最主要原因是feedListSelector的相关依赖数据feedById，userById等中含有与feedList_1无关的数据。那么我们能不能将相关数据存储在一起，这样feedListSelector就不会依赖无关数据了。

以上文提到的简单的feed列表为例，其修改后的store结构如下：

```JS
{
  feed: new Map({
    feedList_1: new Map({
      idList: new List([id_1, id_2, id_3]),
      feedById: new Map({
        id_1: FeedRecord_1,
        id_2: FeedRecord_2,
        id_3: FeedRecord_3
      })
    }),
    feedList_2: new Map({
      idList: new List([id_1, id_4, id_5]),
      feedById: new Map({
        id_1: FeedRecord_1,
        id_4: FeedRecord_4,
        id_5: FeedRecord_5
      })
    })
  }),
  ...
}
```

这里，每个feedList拥有属于自己的idList和feedById，在渲染feedList_1时，feedListSelector之需要依赖feedList_1这一处数据了，修改后的获取feedList的代码如下：

```JS
import { createSelector } from 'reselect'

const getFeedList = (state, feedListKey) => state['feed'].get(feedListKey)

const feedListSelectorCb = (feedListMap) => {
  let feedMap = feedListMap.get('feedById')
  let feedIds = feedListMap.get('idList').toJS()
  let feedList = feedIds.map((feedId) => {
    return feedMap.get(feedId)
  })
}
const feedListSelector = createSelector(getFeedList, feedListSelectorCb)

const mapStateToProps = (state, ownProps) => {
  const feedListKey = 'feedList_1'
  let feedList = feedListSelector(state, feedListKey)
  return {
    feedList: feedList,
    // other data
  }
}
```

因为我们的feedListSelector不再依赖无关数据，当id_4或id_5对应的FeedRecord发生改变时，不会再引起feedList_1的重新渲染。但时，这种store结构存在以下问题：

+ store中存在重复的数据，id_1对应的FeedRecord同时存在于feedList_1和feedList_2中，可能会出现较大的数据冗余；
+ 当feedList_2中id_1对应的FeedRecord发生改变时，feedList_1也不会重新渲染，暨相关数据改变不引起界面渲染的问题；

### 2. 我们该如何定义我们的数据模型: 'Normalized Data Model' vs 'Embedded Data Model'

上文中在分析简单的feed列表时，提到了两种数据模型。第一种是Normalized Data Model，该模型与reselect一起使用时，会导致'因store中无关数据的改变而引起不必要的界面渲染' 的问题；第二种是Embedded Data Model，该模型与reselect一起使用时，存在'store中相关数据改变不引起界面渲染'的问题。那么我们该如何定义store中的数据模型呢？

#### 2.1 介绍两个概念：store model和display model，以及一些通用做法

使用Redux时，我们需要处理的数据主要分为两部分：体现应用全局状态的store部分数据和用于渲染特定界面而计算出的衍生数据。这两部分数据一般采用不同的数据模型：

+ store model: store中存储数据时采用的数据模型，一般为Normalized Data Model；
+ display model: 渲染界面时需要的数据模型，一般为Embedded Data Model；

**我们通过mapStateToProps和selector将store中Normalized的数据转换成界面需要的Embedded类型数据**。

#### 2.2 简单分析一下Normalized和Embedded两种数据模型的优缺点

一个Normalized Data Model的例子：

```JS
{
  feedList: [feedId_1, feedId_2, feedId_3, ...],
  feedById: {
    feedId_1: {
      id: feedId_1,
      title: 'Feed Title',
      content: 'Feed Content',
      creator: userId_1
    },
    feedId_2: { ... },
    ...
  },
  userList: [userId_1, userId_2, ...],
  userById: {
    userId_1: {
      id: userId_1 , nickname: 'nickname', avatar: 'avatar.png', ...
    },
    ...
  }
}
```

一个Embedded Data Model的例子：

```JS
{
  feedList: [
    {
      id: feedId_1,
      title: 'Feed Title',
      content: 'Feed Content',
      creator: {
        id: userId_1 , nickname: 'nickname', avatar: 'avatar.png', ...
      },
      ...
    },
    ...
  ],
  userList: [
    {
      id: userId_1 , nickname: 'nickname', avatar: 'avatar.png', ...
    },
    ...
  ]
}
```

Normalized Data Model:

+ 优点: 通过id来关联数据，数据的存储是扁平化的，无数据冗余，数据一致性高且更新操作比较简单；
+ 缺点: 为了渲染相关数据，需要de-normalized，暨将数据转换成适合UI渲染的Embedded结构的数据，当数据量较大时，这个过程可能比较耗时；还可能因为前文提到的创建新对象的问题，引起不必要的界面渲染；

Embedded Data Model:

+ 优点: 渲染数据的效率较高
+ 缺点: 数据是嵌套的，存在较大的数据冗余，为了保证数据的一致性，需要复杂(有时可能是低效)的数据更新逻辑。例如，当userId_1的avatar发生改变时，在Normalized Data Model结构中，只需要根据对应的id在userById中找到UserRecord，然后更新其avatar值即可。而在Embedded Data Model中，需要分别遍历feedList和userList，找到对应的UserRecord，然后进行更新操作。

更多关于Normalized Data Model与Embedded Data Model的讨论，请参考[Data Model Design](https://docs.mongodb.com/manual/core/data-model-design/)。Git上一些相关这两种模型的讨论与资料(react，redux体系下):

+ [How to handle case where the store "model" differs from the "display" model](https://github.com/este/este/issues/519)
+ [Memoizing Hierarchial Selector](https://github.com/reduxjs/reselect/issues/47)
+ [Performance Issue with Hierarchical Structure](https://github.com/reduxjs/redux/issues/764)
+ [TreeView.js](https://gist.github.com/ronag/bc8b9a33da172520e123)
+ [normalizr](https://github.com/paularmstrong/normalizr)
