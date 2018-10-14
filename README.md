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

**思考：为什么store中不相关的数据的改变会引起界面的重新渲染？**

## 三、Redux

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

> 个人注解：要避免Redux中的state覆盖子组件的props(来自父组件)，可以通过connect的第三参数mergeProps来避免上述情况发生。