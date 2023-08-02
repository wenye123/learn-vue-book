(() => {
  let activeEffect; // 存储被注册的副作用函数
  // 注册副作用函数
  function effect(fn) {
    // 将副作用函数包装一层
    const effectFn = () => {
      // 执行函数前清除之前的依赖集合
      cleanup(effectFn);
      activeEffect = effectFn;
      fn(); // 执行副作用函数会重新收集依赖
    };
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
  const data = { ok: true, text: "wenye" };
  const obj = new Proxy(data, {
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
    // 执行副作用函数会有一个先删除后添加动作 在set中会造成死循环 因此定义一个新的set用于遍历
    // deps.forEach((fn) => fn());
    const runDeps = new Set(deps);
    runDeps.forEach((fn) => fn());
  }

  effect(() => {
    document.body.innerText = obj.ok ? obj.text : "not";
    console.log("执行副作用函数");
  });
  setTimeout(() => {
    obj.text = "yiye"; // 修改值触发依赖
    setTimeout(() => {
      obj.ok = false; // 设置ok为false 去掉text的依赖
      setTimeout(() => {
        obj.text = "wenye"; // 再次修改text的值已无卵用
      }, 1000);
    }, 1000);
  }, 1000);
})();
