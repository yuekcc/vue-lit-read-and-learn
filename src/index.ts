import { render, TemplateResult } from 'lit-html'
import { shallowReactive, effect, ReactiveEffect } from '@vue/reactivity'

let currentInstance = null

type LifecycleCallback = () => void
type Factory = () => () => TemplateResult

export function defineComponent(name: string, factory: Factory): void
export function defineComponent(
  name: string,
  propDefs: string[],
  factory: Factory
): void
export function defineComponent(
  name: string,
  propDefs: string[] | Factory,
  factory?: Factory
): void {
  // 支持两种参数方式
  if (typeof propDefs === 'function') {
    factory = propDefs
    propDefs = []
  }

  // 自定义一个 web component 组件
  customElements.define(
    name,
    class extends HTMLElement {
      // 素属性变化后，触发 attributeChangedCallback() 回调函数，需要实现 observedAttributes getter
      static get observedAttributes() {
        return propDefs
      }

      private _props!: Record<string, any>
      private _bm!: LifecycleCallback[]
      private _bu!: LifecycleCallback[]
      private _u!: LifecycleCallback[]
      private _m!: LifecycleCallback[]
      private _um!: LifecycleCallback[]

      constructor() {
        super()

        // 将 this._props 包装为一个响应对象
        // shallowReactive 是创建一个浅层的响应式对象
        const props = (this._props = shallowReactive<Record<string, any>>({}))

        // currentInstance 指向当前构建的组件
        currentInstance = this

        // 调用工厂函数，创建组件
        // 在工厂函数中调用的生命周期注册函数此刻是指向当前正在构建的组件
        // 工厂函数实际上是生成一个 lit-html 工厂函数
        const template = factory.call(this, props)

        // currentInstance 重新设置为 null
        currentInstance = null

        // 调用 onBeforeMount 中注册的回调
        this._bm && this._bm.forEach((cb) => cb())

        // 创建一个 Shadow DOM
        const root = this.attachShadow({ mode: 'closed' })

        // 标记是否已经挂载
        let isMounted = false

        // 响应 this._props 变化
        effect(() => {
          if (!isMounted) {
            // 调用 onBeforeUpdate 中注册的回调
            this._bu && this._bu.forEach((cb) => cb())
          }

          // lit-html api，将 html template 渲染为 DOM
          render(template(), root)

          if (isMounted) {
            // mounted 后，调用 onUpdated 中注册的回调
            this._u && this._u.forEach((cb) => cb())
          } else {
            isMounted = true
          }
        })
      }

      // 重写 web component api
      // 当自定义元素第一次被连接到文档DOM时被调用
      connectedCallback() {
        // 调用 onMounted 中注册的回调
        this._m && this._m.forEach((cb) => cb())
      }

      // 重写 web component api
      // 当自定义元素与文档DOM断开连接时被调用
      disconnectedCallback() {
        // 调用 onUnmounted 中注册的回调
        this._um && this._um.forEach((cb) => cb())
      }

      // 重写 web component api
      // 当自定义元素的一个属性被增加、移除或更改时被调用
      attributeChangedCallback(name, oldValue, newValue) {
        // 触发响应
        this._props[name] = newValue
      }
    }
  )
}

function createLifecycleMethod(name): (cb: LifecycleCallback) => void {
  return (cb: LifecycleCallback) => {
    if (currentInstance) {
      ;(currentInstance[name] || (currentInstance[name] = [])).push(cb)
    }
  }
}

export const onBeforeMount = createLifecycleMethod('_bm')
export const onMounted = createLifecycleMethod('_m')
export const onBeforeUpdate = createLifecycleMethod('_bu')
export const onUpdated = createLifecycleMethod('_u')
export const onUnmounted = createLifecycleMethod('_um')

export * from 'lit-html'
export * from '@vue/reactivity'
