window.Vue = ((exports) => {
  let activeEffect; // 存储被注册的副作用函数
  const effectStack = []; // effect栈
  // 注册副作用函数
  function effect(fn, options = {}) {
    // 将副作用函数包装一层
    const effectFn = () => {
      // 执行函数前清除之前的依赖集合
      cleanup(effectFn);
      activeEffect = effectFn;
      effectStack.push(activeEffect); // 执行副作用函数之前压入栈
      const res = fn(); // 执行副作用函数会重新收集依赖
      // 执行完后弹出栈 并重置activeEffect的值
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
      return res;
    };
    // 存储选项
    effectFn.options = options;
    // 副作用函数存储对应的依赖集合
    effectFn.deps = [];
    // 不是懒加载模式才执行
    if (!options.lazy) {
      effectFn();
    }
    return effectFn;
  }
  // 清除依赖集合函数
  function cleanup(effectFn) {
    // 将依赖集合删除副作用函数
    for (let deps of effectFn.deps) {
      deps.delete(effectFn);
    }
    // 重置副作用函数依赖集合长度
    effectFn.deps.length = 0;
  }

  // 使用weakMap是为了不计入垃圾回收引入
  const bucket = new WeakMap();
  function reactive(data) {
    return new Proxy(data, {
      get(target, key) {
        track(target, key);
        return target[key];
      },
      set(target, key, newVal) {
        target[key] = newVal;
        trigger(target, key);
        return true;
      },
    });
  }
  function track(target, key) {
    if (!activeEffect) return;
    // 获取对象map
    let depsMap = bucket.get(target);
    if (!depsMap) bucket.set(target, (depsMap = new Map()));
    // 获取对象key map，值为set
    let deps = depsMap.get(key);
    if (!deps) depsMap.set(key, (deps = new Set()));
    deps.add(activeEffect);
    // 副作用函数添加依赖集合
    activeEffect.deps.push(deps);
  }
  function trigger(target, key) {
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    const deps = depsMap.get(key);
    if (!deps) return;
    const runDeps = new Set();
    deps.forEach((fn) => {
      if (fn !== activeEffect) {
        runDeps.add(fn);
      }
    });
    runDeps.forEach((effectFn) => {
      // 如果存在调度器则使用
      if (effectFn.options.scheduler) {
        effectFn.options.scheduler(effectFn);
      } else {
        effectFn();
      }
    });
  }

  // 计算属性
  function computed(getter) {
    // value用于缓存 dirty为true表示脏需要重新计算
    let value,
      dirty = true;

    // 创建一个lazy的effect
    const effectFn = effect(getter, {
      lazy: true,
      scheduler(fn) {
        dirty = true;
        // 手动trigger
        trigger(obj, "value");
        // fn(); // 注意这里不能直接执行 不然每次getter的依赖更新都会重新执行
      },
    });

    const obj = {
      // 读取时候才执行
      get value() {
        if (dirty) {
          value = effectFn();
          dirty = false;
        }
        // 手动track
        track(obj, "value");
        return value;
      },
    };
    return obj;
  }

  // const obj = reactive({ a: 1, b: 2 });
  // // 计算属性
  // const sum = computed(() => {
  //   console.log("执行计算属性");
  //   return obj.a + obj.b;
  // });
  // // effect读取计算属性
  // effect(() => {
  //   console.log("effect读取计算属性", sum.value);
  // });
  // obj.a++;

  exports.effect = effect;
  exports.reactive = reactive;
  exports.track = track;
  exports.trigger = trigger;
  exports.computed = computed;

  return exports;
})({});
