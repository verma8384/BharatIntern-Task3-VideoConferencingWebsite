const APP_ID = "YOUR_APP_ID";

//for each user
let uid = sessionStorage.getItem("uid");

if (!uid) {
  uid = String(Math.floor(Math.random() * 10000));
  sessionStorage.setItem("uid", uid);
}

//RTC
let token = null;
let client;

//RTM
let rtmClient;
let channel;

//room.html/room=234 for getting room number from url
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get("room");
let displayName = sessionStorage.getItem("display_name");

if (!roomId) {
  roomId = "main";
}

if (!displayName) {
  window.location = "lobby.html";
}
//users streams
let localTracks = [];
let remoteUser = {};

//screen share
let localScreenTracks;
let sharingScreen = false;

//user room joined

let joinRoomInit = async () => {
  //RTM
  rtmClient = await AgoraRTM.createInstance(APP_ID);
  await rtmClient.login({ uid, token });

  await rtmClient.addOrUpdateLocalUserAttributes({ name: displayName });

  channel = await rtmClient.createChannel(roomId);
  await channel.join();

  channel.on("MemberJoined", handleMemberJoined);
  channel.on("MemberLeft", handleMemberLeft);
  channel.on("ChannelMessage", handleChannelMessage);

  getMembers();
  addBotMessageToDom(`Welcome to the room ${displayName} ! 👋`);

  //RTC
  client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  await client.join(APP_ID, roomId, token, uid);

  //event listeners
  client.on("user-published", handleUserPublished); //handle the user published stream
  client.on("user-left", handleUserLeft); //handle the user left stream
};

//join streams

let joinStreams = async () => {
  document.getElementById("join-btn").style.display = "none";
  document.getElementsByClassName("stream__actions")[0].style.display = "flex";

  localTracks = await AgoraRTC.createMicrophoneAndCameraTracks(
    {},
    {
      encoderConfig: {
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 },
      },
    }
  );

  let player = `<div class="video__container" id="user-container-${uid}">
<div class ='video-player' id='user-${uid}'></div>
</div>`;

  //this is going to add a player to dom
  document
    .getElementById("streams__container")
    .insertAdjacentHTML("beforeend", player);

  //dynamic addition of video_container in stream box
  document
    .getElementById(`user-container-${uid}`)
    .addEventListener("click", expandVideoFrame);

  //audio track stored in 0 and video track stored in 1
  localTracks[1].play(`user-${uid}`); //adding the video stream into player

  //publish the track to send streams to all user
  await client.publish([localTracks[0], localTracks[1]]);
};

//remote user

let handleUserPublished = async (user, mediaType) => {
  remoteUser[user.uid] = user;

  //we subscribe to the user to get the video tracks
  await client.subscribe(user, mediaType);

  //we are checking the existing player if not it  will get added to dom
  let player = document.getElementById(`user-container-${user.uid}`);

  if (player === null) {
    player = `<div class="video__container" id="user-container-${user.uid}">
    <div class ='video-player' id='user-${user.uid}'></div>
    </div>`;

    //this is going to add a player to dom
    document
      .getElementById("streams__container")
      .insertAdjacentHTML("beforeend", player);

    document
      .getElementById(`user-container-${user.uid}`)
      .addEventListener("click", expandVideoFrame);
  }

  //new user joined css
  if (displayFrame.style.display) {
    let videoFrames = document.getElementById(`user-container-${user.uid}`);
    player.style.height = "100px";
    player.style.width = "100px";
  }

  //for remote user
  if (mediaType === "video") {
    user.videoTrack.play(`user-${user.uid}`);
  }

  if (mediaType === "audio") {
    user.audioTrack.play();
  }
};

//user left
let handleUserLeft = async (user) => {
  delete remoteUser[user.uid];

  let item = document.getElementById(`user-container-${user.uid}`);
  if (item) {
    item.remove();
  }

  //if stream__box user left the room
  if (userIdInDisplayFrame === `user-container-${user.uid}`) {
    displayFrame.style.display = null;

    let videoFrames = document.getElementsByClassName("video__container");

    //reset the video container css
    for (let i = 0; videoFrames.length > 1; i++) {
      videoFrames[i].style.height = "300px";
      videoFrames[i].style.width = "300px";
    }
  }
};

//toggle action buttons

let toggleMic = async (e) => {
  let button = e.currentTarget;

  if (localTracks[0].muted) {
    await localTracks[0].setMuted(false);
    button.classList.add("active");
  } else {
    await localTracks[0].setMuted(true);
    button.classList.remove("active");
  }
};

let toggleCamera = async (e) => {
  let button = e.currentTarget;

  if (localTracks[1].muted) {
    await localTracks[1].setMuted(false);
    button.classList.add("active");
  } else {
    await localTracks[1].setMuted(true);
    button.classList.remove("active");
  }
};

//screen share

let toggleScreen = async (e) => {
  let screenButton = e.currentTarget;
  let cameraButton = document.getElementById("camera-btn");

  if (!sharingScreen) {
    sharingScreen = true;

    screenButton.classList.add("active");
    cameraButton.classList.remove("active");
    cameraButton.style.display = "none";

    //creating screen track
    localScreenTracks = await AgoraRTC.createScreenVideoTrack();
    document.getElementById(`user-container-${uid}`).remove();
    displayFrame.style.display = "block";

    let player = `<div class="video__container" id="user-container-${uid}">
   <div class ='video-player' id='user-${uid}'></div>
   </div>`;

    //inserting the screen track in stream box
    displayFrame.insertAdjacentHTML("beforeend", player);
    document
      .getElementById(`user-container-${uid}`)
      .addEventListener("click", expandVideoFrame);

    userIdInDisplayFrame = `user-container-${uid}`;

    //stream the screen track
    localScreenTracks.play(`user-${uid}`);

    //unpublished the video track
    await client.unpublish([localTracks[1]]);

    //publish the track to send screen to all user
    await client.publish([localScreenTracks]);

    let videoFrames = document.getElementsByClassName("video__container");

    // the video container css to 100px
    for (let i = 0; videoFrames.length > 1; i++) {
      videoFrames[i].style.height = "100px";
      videoFrames[i].style.width = "100px";
    }
  } else {
    sharingScreen = false;
    cameraButton.style.display = "block";

    document.getElementById(`user-container-${uid}`).remove();

    //unpublished the video track
    await client.unpublish([localScreenTracks]);

    //this to change from screen to video
    switchToCamera();
  }
};

let switchToCamera = async () => {
  let player = `<div class="video__container" id="user-container-${uid}">
  <div class ='video-player' id='user-${uid}'></div>
  </div>`;

  displayFrame.insertAdjacentHTML("beforeend", player);

  await localTracks[0].setMuted(true);
  await localTracks[1].setMuted(true);

  document.getElementById("mic-btn").classList.remove("active");
  document.getElementById("screen-btn").classList.remove("active");

  localTracks[1].play(`user-${uid}`);

  //publish the track to send video to all user
  await client.publish([localTracks[1]]);
};

//leave stream
let leaveStream = async (e) => {
  e.preventDefault();
  document.getElementById("join-btn").style.display = "flex";
  document.getElementsByClassName("stream__actions")[0].style.display = "none";

  for (let i = 0; localTracks.length > i; i++) {
    localTracks[i].stop();
    localTracks[i].close();
  }
  await client.unpublish([localTracks[0], localTracks[1]]);

  if (localScreenTracks) {
    await client.unpublish([localScreenTracks]);
  }

  document.getElementById(`user-container-${uid}`).remove();

  if (userIdInDisplayFrame === `user-container-${uid}`) {
    displayFrame.style.display = null;

    //reset the video container css
    for (let i = 0; videoFrames.length > i; i++) {
      videoFrames[i].style.height = "300px";
      videoFrames[i].style.width = "300px";
    }
  }
  channel.sendMessage({
    text: JSON.stringify({ type: "'user_left", uid: uid }),
  });
};

document.getElementById("mic-btn").addEventListener("click", toggleMic);
document.getElementById("camera-btn").addEventListener("click", toggleCamera);
document.getElementById("screen-btn").addEventListener("click", toggleScreen);
document.getElementById("join-btn").addEventListener("click", joinStreams);
document.getElementById("leave-btn").addEventListener("click", leaveStream);

joinRoomInit();