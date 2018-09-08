<!---
    Copyright 2018 leichen@live.com
 
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
 
        http://www.apache.org/licenses/LICENSE-2.0
 
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
-->

# Quick Start

```javascript
const client = new WechatAccessToken({ redis: 'redis://:@127.0.0.1:6379' });

const result1 = client.getAccessToken({  appID: '', appSecret: ''});
const result2 = client.getAccessToken({  appID: '', appSecret: ''});
const result3 = client.getAccessToken({  appID: '', appSecret: ''});

Promise
  .all([result1, result2, result3])
  .then(values => {
    console.log(values);
  })
  .catch(error => {
    console.log(error);
  });
```

# License
Apache 2.0