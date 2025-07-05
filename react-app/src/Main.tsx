import React from "react";

export function Main(props: any) {

    return (
    <>
    <div>
        <Card title="Innovation" content="Welcome to FabAI" type="Main"/>
    </div>
    <div className="Main">
        <Card title="AI Classifier" content="Use our AI model to add clothes to your inventory" type="Sub"/>
    </div>
    </>
    );
}
export function Card(props: any) {
    const cardMain = (
    <div className='cardMain'>
        <h2>{props.title}</h2>
        
        <h3>{props.content}</h3>
    </div>
    );

    const cardSub = (
    <div className='cardSub'>
        <h3>{props.title}</h3>
        
        <h4>{props.content}</h4>
    </div>
    );
    return props.type == 'Main' ? cardMain : cardSub;
}
export function Navbar() {
    const bar = (
    <div className='nav'>
        <h1>FabAI</h1>
    </div>
    );
    return bar;
}
