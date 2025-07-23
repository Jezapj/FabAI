import React, { useCallback, useEffect } from "react";
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

export function Login() {
  const [user, setUser] = React.useState<any>(null);
  const [classid, setClassid] = React.useState<any>("");

  useEffect(() => {
    setClassid("b2")
  }, [user])

  const [prediction, setPrediction] = React.useState('');
  const [imageId, setImageId] = React.useState(1);  // Set to the ID of the image you want to classify

  const handlePredict = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/predict_image/${imageId}`);
      console.log(response)
      const data = await response.json();
      setPrediction(data.prediction);  // Set prediction from the response
      console.log(prediction)
    } catch (error) {
      console.error('Error fetching prediction:', error);
    }
  };

  
  const handleOutfit = () => {
  console.log(user)
  const userId = user?.sub; // or however you store it
  
  const targetValue = 50; // example target value

  if (!userId) {
    console.error("User ID missing");
    return;
  }

  const url = `http://localhost:5000/api/outfit?user_id=${userId}&target=${targetValue}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      console.log("Outfit result:", data);
      // handle result (e.g., update UI)
    })
    .catch(err => {
      console.error("Failed to fetch outfit:", err);
    });
};

  const [image, setImage] = React.useState<any>(null);
  const [imageUrl, setImageUrl] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);


  // Handle the file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);

      const formData = new FormData();
      formData.append("image", file);
      formData.append("user_info", JSON.stringify(user)); // Send user info

      fetch("http://localhost:5000/api/uploadnx", {
        method: "POST",
        body: formData,
      })
        .then(res => res.json())
        .then(data => {
          console.log("Upload success:", data);
          const img_id = data.image_id;
          setImageId(img_id)///////

          // Construct the URL to view the image
          setImageUrl(`http://localhost:5000/api/image/${img_id}`);
          if (dialogRef.current) {
            dialogRef.current.showModal(); // Opens the dialog using .showModal()
          }
        })
        .catch(err => {
          console.error("Upload failed:", err);
        });
    }
  };

  return (
    <div className={classid}>
      {user ? (
        <>
          {/* Enhanced Dialog */}
          <dialog ref={dialogRef} onClick={() => dialogRef.current?.close()}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Uploaded Image</h2>
                
              </div>
              <div className="modal-body">
                <img className="imageStyle" src={imageUrl} alt="Uploaded" />
                
              </div>
              <h1>{prediction}</h1>
              <div className="modal-footer">
                <button className="modal-close-button" onClick={() => {dialogRef.current?.close();setPrediction("")}}>&times;</button>
                <button className="modal-close-button" onClick={() => handlePredict()}>Predict</button>
                <button className="modal-close-button" onClick={() => handleOutfit()}>Get Outfit</button>
                {/*<button className="modal-button" onClick={() => dialogRef.current?.close()}>Close</button>*/}
              </div>
            </div>
          </dialog>

          <Card title={"Welcome " + `${user.name}`} content="Start creating your catalogue here" type="Main" bg={false} />
          <div style={{ display: "flex" }}>
            <button className="b1" onClick={() => { document.getElementById('fileInput')?.click() }}><h4>Add Image</h4></button>
            <input
              id="fileInput"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }} // Hide the file input
            />
            <button className="b1" onClick={() => {
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

            // Send token to backend for validation + session creation
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
