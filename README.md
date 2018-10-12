Reselect库

---

本文章非原创，大部分参照[关于react, redux, react-redux和reselect的一些思考](https://zhuanlan.zhihu.com/p/33985606)文章来进行工程化实践。

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

### 1. 简单回顾一下Redux相关知识

redux中有三个核心元素：store，reducer和action。其中store作为应用的唯一数据源，用于存储应用在某一时刻的状态数据；store是只读的，且只能通过action来改变，暨通过action将状态1下的store转换为状态2下的store；reducer用于定义状态转换的具体细节，并与action相对应；应用的UI部分可以通过store提供的**subscribe方法来监听store的改变**，当状态1下的store转换为状态2下的store时，所有通过subscribe方法注册的监听器(listener)都会被调用。

### 2. connect返回的是一个监听了store改变的HOC

*注意：本文中所有react-redux源码片段均来自react-redux@4.4.6，下文中将不再重复强调。*

下面是react-redux的部分源码：

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
       const {
         // ...
         renderedElement
       } = this

       // ...
       if (!haveMergedPropsChanged && renderedElement) {
         return renderedElement
       }
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