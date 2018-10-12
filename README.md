Reselect库

---

非原创，参照[关于react, redux, react-redux和reselect的一些思考](https://zhuanlan.zhihu.com/p/33985606)文章进行的工程化实践。

## 一、搭建环境

项目实践初始化代码，见分支[daily/0.0.1](https://github.com/Bian2017/web-performance-optimization-reselect/tree/daily/0.0.1)。

1. 安装依赖

> npm install

2. 代码编译

> npm run dev

3. 在浏览器打开public目录下的index.html。

## 二、遇到的问题

### 1. 场景描述

界面如下：

![]()

其中，demo_A、demoe_B为reducer key。组件A，组件B通过connect分别显示demo_A、demo_B中的counter值；当点击Button A和Button B时，分别通过DEMO_ACTION_A和DEMO_ACTION_B来更新demo_A、demo_B中的counter值。

**期望结果**

