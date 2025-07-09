import React from "react";

export function Main(props: any) {

    return (
    <>
    <div>
        <Card title="Innovation" content="Welcome to FabAI" type="Feature" img="src/assets/Promo.png"/>
    </div>
    <div className="Main">
        <Card title="AI Classifier" content="Use our AI model to add clothes to your inventory" type="Sub" img=""/>
    </div>
    
    </>
    
    );
}
export function Card(props: any ) {
     const cardFeature = (
    <div className='cardFeature' style={{backgroundImage: `url("${props.img}")`}}>
        <h2>{props.title}</h2>
        
        <h3>{props.content}</h3>
    </div>
    );
    const cardMain = (
    <div className='cardMain' style={{backgroundImage: `url("${props.img}")`}}>
        <h2>{props.title}</h2>
        
        <h3>{props.content}</h3>
    </div>
    );

    const cardSub = (
    <div className='cardSub'  style={{backgroundImage: `url("${props.img}")`}}>
        <h1>{props.title}</h1>
        
        <h3>{props.content}</h3>
    </div>
    );
    if (props.type == "Feature"){
        return cardFeature
    }
    return props.type == 'Main' ? cardMain : cardSub;
}

const navClickHandler = () => {
    
    window.location.assign("http://localhost:3000/");
    return 0;

}
export function Navbar() {
    const bar = (
    <div className='nav'>
        <h1>Fab</h1>
        <img src="src/assets/CirculationsLogoNoBg.png" onClick={() => navClickHandler()} height="80px" width="100px"></img>
        <h1>AI</h1>
    </div>
    );
    return bar;
}
