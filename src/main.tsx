import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
class Boundary extends React.Component<React.PropsWithChildren,{failed:boolean}> {
 state={failed:false}; static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main><h1>暂时无法显示</h1><p>本地卡片未被删除。请重新打开应用；若持续出现，请保留浏览器数据并联系维护者。</p><button onClick={()=>location.reload()}>重新打开</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<Boundary><App/></Boundary>);
