((exports) => {
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
      fn(); // 执行副作用函数会重新收集依赖
      // 执行完后弹出栈 并重置activeEffect的值
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    };
    // 存储选项
    effectFn.options = options;
    // 副作用函数存储对应的依赖集合
    effectFn.deps = [];
    // 执行包装后的副作用函数
    effectFn();
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

  // 使用队列控制执行次数
  const jobQueue = new Set();
  const p = Promise.resolve();
  let isFlushing = false; // 是否正在刷新队列
  function flushJob() {
    if (isFlushing) return;
    isFlushing = true;
    p.then(() => {
      jobQueue.forEach((job) => job());
    }).finally(() => {
      isFlushing = false;
    });
  }

  const obj = reactive({ name: "wenye", age: 28 });
  effect(
    () => {
      console.log(obj.age);
    },
    {
      scheduler(fn) {
        jobQueue.add(fn);
        flushJob();
      },
    }
  );
  obj.age++;
  obj.age++;
  console.log("执行结束");

})({});
