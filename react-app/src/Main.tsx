import React, { useCallback, useEffect } from "react";
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import {jwtDecode} from 'jwt-decode';

export function Login(){
const [user, setUser] = React.useState<any>(null);
const [classid, setClassid] = React.useState<any>("");
//const feet = {"height": "40px", "backgroundColor": "rgba(0,0,0, 0.85)"};
useEffect(() => {
setClassid("b2")
}, [user])
  return (
    <div className={classid}>
    

      {user ? (
        <>
          
          <Card title={"Welcome " + `${user.name}`} content="Start creating your catalogue here" type="Main" bg={false}/>
          <div style={{"display": "flex"}}>
          <button className="b1"  onClick={() => {
          }}><h4>Add Image</h4></button>
          <button className="b1"  onClick={() => {
            googleLogout();
            setUser(null);  
            setClassid("");
          }}><h4>Logout</h4></button>
          </div>
          
        </>
      ) : (
        <GoogleLogin
          onSuccess={credentialResponse => {
            const decoded: any = jwtDecode(credentialResponse.credential || '');
            console.log("Decoded JWT:", decoded);
            setUser(decoded);

            // 🔐 Send token to backend for validation + session creation
            fetch("http://localhost:5000/api/auth", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ id_token: credentialResponse.credential })
            });
          }}
          onError={() => {
            console.log('Login Failed');
          }}
        />
      )}

    </div>
  );
}
export function Main(props: any) {

    
    return (
    <>
    <div>
        <Card title="Innovation" content="Welcome to FabAI" type="Feature" img="" bg={true}/> 
    </div>
    <div className="Main">
      <div className="bg"><Card title="AI Classifier" content="Use our AI model to add clothes to your inventory" type="Sub" img="src/assets/shirt.png" img2="src/assets/shoes.png" bg={true}/></div>
        
    </div>
    
    </>
    
    );
}
export function Card(props: any ) {

  const bg = props.bg === true ? {"backgroundImage": `url("${props.img}")`}: {"backgroundImage": "", "backgroundColor":"rgba(0, 0, 0, 0)"};
  const cardFeature = (
    <div className='cardFeature' style={bg}>
        <h1>{props.title}</h1>
        
        <h2>{props.content}</h2>
    </div>
    );
    const cardMain = (
    <div className='cardMain' style={bg}>
        <h2>{props.title}</h2>
        
        <h3>{props.content}</h3>
    </div>
    );
    let active = false;
    const [ contents, setContents] = React.useState({"display":"none","opacity":"0","transition":"2s","transition-delay":"4.5s"});
    const [ subContents1, setSubContents1] = React.useState({"display":"block","transition":"2s","opacity":"0"});
    const [ subContents2, setSubContents2] = React.useState({"display":"block","opacity":"0"});
    const cardSub = (
    <div className='cardSub' onMouseOver={() => {
      active = true;
      if (active){

        setTimeout(setSubContents1, 0, {"display":"block","opacity":"0"})
      setTimeout(setSubContents2, 0, {"display":"block","opacity":"0"})
      //setTimeout(setContents, 0, ({"display":"inline-flex","opacity":"0"}))

        setContents({"display":"inline-flex","opacity":"1","transition":"2s","transition-delay":"0.5s"})
          setTimeout(setSubContents1, 1000,{"opacity":"1","transition":"2s"})
          setTimeout(setSubContents2, 1700,{"opacity":"1","transition":"2s","transition-delay":"0.5s"})

      }
      
          }} 
        onMouseLeave={() => {
          active = false
      //setSubContents1({"display":"none","transition":"2s", "opacity":"0"})
      setTimeout(setSubContents1, 0, {"opacity":"0","transition":"1s","transition-delay":"0s"})
      setTimeout(setSubContents2, 0, {"opacity":"0","transition":"1s","transition-delay":"0s"})
      setTimeout(setContents, 1000, ({"opacity":"0","transition":"0s","transition-delay":"0.5s"}))

      setTimeout(setSubContents1, 1000, {"display":"none","opacity":"0"})
      setTimeout(setSubContents2, 1000, {"display":"none","opacity":"0"})
      setTimeout(setContents, 1000, ({"display":"none","opacity":"0"}))
          }} >
      <div className="subText">
        <h1>{props.title}</h1>
        
        <h3>{props.content}</h3>
        </div>
        <div className="subImg" style={contents}>
        <img src={props.img} style={subContents1}></img>
        <img src={props.img2}style={subContents2}></img>
        </div>
        
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
