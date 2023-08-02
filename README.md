### 《vue设计与实现》代码实现

**目录**

```bash
├── 1.框架设计概览                                                                                                                                                              
│   ├── 1.权衡的艺术                                                                                                                                                            
│   │   └── 权衡的艺术.html                                                                                                                                                     
│   ├── 2.框架设计的核心要素                                                                                                                                                    
│   │   └── 框架设计的核心要素.html                                                                                                                                             
│   └── 3.vue3的设计思路                                                                                                                                                        
│       └── vue3的设计思路.html                                                                                                                                                 
├── 2.响应系统                                                                                                                                                                  
│   ├── 1.响应系统的作用与实现                                                                                                                                                  
│   │   ├── 10.立即执行的watch与回调执行时机.js                                                                                                                                 
│   │   ├── 11.过期的副作用.js                                                                                                                                                  
│   │   ├── 2.响应式数据的基本实现.js                                                                                                                                           
│   │   ├── 3.设计一个完善的响应系统.js                                                                                                                                         
│   │   ├── 4.分支切换与cleanup.js                                                                                                                                              
│   │   ├── 5.嵌套的effect与effect栈.js                                                                                                                                         
│   │   ├── 6.避免无限递归循环.js                                                                                                                                               
│   │   ├── 7.调度执行.js                                                                                                                                                       
│   │   ├── 8.计算属性computed与lazy.js                                                                                                                                         
│   │   ├── 9.watch的实现原理.js                                                                                                                                                
│   │   └── 响应系统的作用和实现.html                                                                                                                                           
│   ├── 2.非原始值的响应式方案                                                                                                                                                  
│   │   ├── 1.理解Proxy和Relect.js                                                                                                                                              
│   │   ├── 2.js对象和Proxy的工作原理.js                                                                                                                                        
│   │   ├── 3.如何代理Object.js                                                                                                                                                 
│   │   ├── 4.合理地触发响应.js                                                                                                                                                 
│   │   ├── 5.浅响应和深响应.js                                                                                                                                                 
│   │   ├── 6.只读和浅只读.js                                                                                                                                                   
│   │   ├── 7.代理数组.js                                                                                                                                                       
│   │   ├── 8.代理Set和Map.js                                                                                                                                                   
│   │   └── 非原始值的响应式方案.html                                                                                                                                           
│   └── 3.原始值的响应式方案                                                                                                                                                    
│       ├── 原始值的响应式方案.html                                                                                                                                             
│       └── 原始值的响应式方案.js                                                                                                                                               
├── 3.渲染器                                                                                                                                                                    
│   ├── 1.渲染器的设计                                                                                                                                                          
│   │   ├── 渲染器的设计.html                                                                                                                                                   
│   │   └── 渲染器的设计.js                                                                                                                                                     
│   ├── 2.挂载与更新                                                                                                                                                            
│   │   ├── 1.挂载子节点和元素的属性.js                                                                                                                                         
│   │   ├── 10.文本节点和注释节点.js                                                                                                                                            
│   │   ├── 11.fragment.js                                                                                                                                                      
│   │   ├── 2.html属性和dom属性.js                                                                                                                                              
│   │   ├── 3.正确地设置元素属性.js                                                                                                                                             
│   │   ├── 4.class的处理.js                                                                                                                                                    
│   │   ├── 5.卸载操作.js                                                                                                                                                       
│   │   ├── 6.区分vnode的类型.js                                                                                                                                                
│   │   ├── 7.事件的处理.js                                                                                                                                                     
│   │   ├── 8.事件冒泡与更新时机问题.js                                                                                                                                         
│   │   ├── 9.更新子节点.js                                                                                                                                                     
│   │   └── 挂载与更新.html                                                                                                                                                     
│   ├── 3.简单diff算法                                                                                                                                                          
│   │   ├── 1.减少DOM操作的性能开销.js                                                                                                                                          
│   │   ├── 2.通过key实现dom复用.js                                                                                                                                             
│   │   └── 简单diff算法.html                                                                                                                                                   
│   ├── 4.双端diff算法                                                                                                                                                          
│   │   ├── 1.双端diff算法.js                                                                                                                                                   
│   │   └── 双端diff算法.html                                                                                                                                                   
│   └── 5.快速diff算法                                                                                                                                                          
│       ├── 1.快速diff算法.js                                                                                                                                                   
│       └── 快速diff算法.html                                                                                                                                                   
├── 4.组件化                                                                                                                                                                    
│   ├── 1.组件的实现原理                                                                                                                                                        
│   │   ├── 组件的实现原理.html                                                                                                                                                 
│   │   └── 组件的实现原理.js                                                                                                                                                   
│   ├── 2.异步组件与函数式组件                                                                                                                                                  
│   │   ├── 1.异步组件.js                                                                                                                                                       
│   │   ├── 2.函数组件.js                                                                                                                                                       
│   │   ├── com.js                                                                                                                                                              
│   │   └── 异步组件与函数式组件.html                                                                                                                                           
│   └── 3.内建组件和模块                                                                                                                                                        
│       ├── 1.keepAlive组件的实现原理.js                                                                                                                                        
│       ├── 2.Teleport组件的实现原理.js                                                                                                                                         
│       ├── 3.Transition组件的实现原理.js                                                                                                                                       
│       └── 内建组件和模块.html                                                                                                                                                 
├── 5.编译器                                                                                                                                                                    
│   ├── 1.编译器核心技术概览                                                                                                                                                    
│   │   ├── 2.的实现原理与状态机.js                                                                                                                                             
│   │   ├── 3.构造AST.js                                                                                                                                                        
│   │   ├── 4.AST的转换与插件化架构.js                                                                                                                                          
│   │   ├── 5.将模板AST转为Javascript_AST.js                                                                                                                                    
│   │   ├── 6.代码生成.js                                                                                                                                                       
│   │   ├── parser.png                                                                                                                                                          
│   │   └── 编译器核心技术概览.html                                                                                                                                             
│   ├── 2.解析器                                                                                                                                                                
│   │   ├── parser.png                                                                                                                                                          
│   │   ├── 解析器.html                                                                                                                                                         
│   │   └── 解析器.js                                                                                                                                                           
│   └── 3.编译优化                                                                                                                                                              
│       ├── 编译优化.html                                                                                                                                                       
│       └── 编译优化.js                                                                                                                                                         
├── 6.服务端渲染                                                                                                                                                                
│   └── 1.同构渲染                                                                                                                                                              
│       ├── 1.渲染字符串.js                                                                                                                                                     
│       ├── 2.客户端激活.js                                                                                                                                                     
│       └── 同构渲染.html 
```

