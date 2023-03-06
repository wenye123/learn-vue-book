(() => {
  let activeEffect; // 存储被注册的副作用函数
  // 注册副作用函数
  function effect(fn) {
    activeEffect = fn;
    fn();
  }

  // 使用weakMap是为了不计入垃圾回收引入
  const bucket = new WeakMap();
  const data = { text: "wenye" };
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
  }
  function trigger(target, key) {
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    const deps = depsMap.get(key);
    if (!deps) return;
    deps.forEach((fn) => fn());
  }

  effect(() => {
    document.body.innerText = obj.text;
  });
  setTimeout(() => {
    obj.text = "yiye"; // 修改值触发依赖
  }, 1000);
})();
