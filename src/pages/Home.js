import {React, useEffect, useRef, useState} from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Firebase Authentication 추가
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from "react-bootstrap/Card";
import {useNavigate} from "react-router-dom";
import book_blue from "../img/book_blue.jpg";
import book_purple from "../img/book_purple.jpg";
import chat from "../img/chat.jpg";
import lock from "../img/lock.jpg";
import {
    collection,
    doc,
    query,
    where,
    orderBy,
    getDocs,
    getDoc,
} from "firebase/firestore";
import { getToken  } from "firebase/messaging";  // FCM 관련 함수 추가
import { db, messaging} from "../firebase-config.js";
import Button from "react-bootstrap/Button";
import { Box, Text } from '@chakra-ui/react';
import NoDiary from '../component/Home/NoDiary.js';
import Diary from '../component/Home/Diary.js';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register("/firebase-messaging-sw.js").then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
            console.error('Service Worker registration failed:', error);
        });
}


function Home(props) {

    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [diaryList, setDiaryList] = useState([]);
    const updateProgress = useRef(true);
    const [emptyList, setEmptyList] = useState(false);
    const [lastDate, setLastDate] = useState("");
    const [userType, setUserType] = useState(null);  // 의사 또는 환자 정보 저장

    const auth = getAuth();  // Firebase 인증 객체

    // 사용자 로그인 상태 확인
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);  // 사용자가 로그인되어 있을 때 상태 저장
                console.log('User logged in:', user.email);
            } else {
                console.log('No user is logged in.');
            }
        });

        return () => unsubscribe();
    }, [auth]);

    // 사용자 유형을 Firestore에서 확인하여 의사 또는 환자 구분
    useEffect(() => {
        async function fetchUserType() {
            console.log("Fetching user type for:", props.userMail);  // 디버깅 로그 추가
    
            const userDocRef = doc(db, "doctor", props.userMail);
            const userDoc = await getDoc(userDocRef);
    
            if (userDoc.exists()) {
                setUserType("doctor");
                console.log("의사 계정입니다. 이메일: ", props.userMail);
            } else {
                setUserType("patient");
                console.log("환자 계정입니다. 이메일: ", props.userMail);
            }
        }
    
        fetchUserType();
    }, [props.userMail]);

    

    
    useEffect(() => {
        async function renewList() {
            console.log("renewList 함수 실행");  // 디버깅 로그 추가
            const diary = await receiveDiaryData();
            await setDiaryList(diary);
            updateProgress.current = false;
        }
    
        if (updateProgress.current) {
            console.log("리스트 갱신 중...");  // 디버깅 로그 추가
            renewList();
        } else {
            if (diaryList.length === 0) {
                setEmptyList(true);
            }
            console.log("Diary List:", diaryList);  // Diary 리스트 확인용 디버깅 로그 추가
            console.log("Last Date:", lastDate);  // 마지막 일기 날짜 확인용 디버깅 로그 추가
        }
    
        // userType이 설정된 후에 FCM 토큰 처리
        console.log("userType 상태 확인:", userType);  // userType 상태 확인용 로그 추가
        if (userType) {
            console.log("FCM 토큰 처리 시작", userType);  // 조건 진입 여부 디버깅 로그 추가
            handleFCMToken(props.userMail, userType);
        } else {
            console.log("userType이 아직 설정되지 않음");  // userType이 설정되지 않은 경우 로그 추가
        }
    
    }, [userType]);  // userType이 변경될 때마다 실행
    
    getToken(messaging, { vapidKey: 'BHxLI9MyVyff7V0GVCp4n6sxF3LwarXbJHHbx1wO2SSil7bgJMy0AiYhONPMrMFpYZ2G6FyDO_AYmHqs-sDJ4p0' }).then((currentToken) => {
        if (currentToken) {
          console.log('Current token for client:', currentToken);
        } else {
          console.log('No registration token available.');
        }
      }).catch((err) => {
        console.error('An error occurred while retrieving token.', err);
      });

    // FCM 토큰을 생성하고, 백엔드에 전송하는 함수
    async function handleFCMToken(userEmail, userType) {
        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                console.log("FCM 토큰 요청 중...");
                console.log("홈-메시징");
                console.log(messaging);
                // Request FCM token using .then() and .catch()
                getToken(messaging, {
                    vapidKey: 'BHxLI9MyVyff7V0GVCp4n6sxF3LwarXbJHHbx1wO2SSil7bgJMy0AiYhONPMrMFpYZ2G6FyDO_AYmHqs-sDJ4p0'
                }).then((currentToken) => {
                    if (currentToken) {                        
                        console.log('FCM Token generated:', currentToken);
        
                        // Send the token to your backend server
                        fetch("https://pocket-mind-bot-43dbd1ff9e7a.herokuapp.com/fcm/register-fcm-token", {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                email: userEmail,
                                userType: userType,  // 'doctor' 또는 'patient'
                                fcmToken: currentToken,
                            }),
                        })
                        .then(response => {
                            if (!response.ok) {
                                console.error('Error registering FCM token:', response.statusText);
                            } else {
                                console.log('FCM token successfully sent to backend');
                            }
                        })
                        .catch(err => {
                            console.error('Error sending FCM token to backend:', err);
                        });
        
                    } else {
                        console.log('No registration token available. Request permission to generate one.');
                    }
                }).catch((err) => {
                    console.error('An error occurred while retrieving token: ', err);
                });
            } else if (permission === "denied") {
                alert("web push 권한이 차단되었습니다. 알림을 사용하시려면 권한을 허용해주세요");
            }
        } catch (error) {
            console.error('Error handling FCM token:', error);
        }
    }        
    

    function navigateToWriting() {
        navigate("/writing");
    }

    function navigateToReview() {
        navigate("/list");
    }

    async function receiveDiaryData() {
        let tempArr = [];
        const userDocRef = doc(db, 'session', props.userMail);
        const diaryCompleteCollRef = collection(userDocRef, 'diary');
        const q = query(diaryCompleteCollRef, where('isFinished', '==', true), orderBy('sessionEnd', 'desc'));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            tempArr.push(doc.data());
        });

        if (tempArr.length === 0) {
            setEmptyList(true);
            return [];
        } else {
            setLastDate(tempArr[tempArr.length - 1]["sessionEnd"]);
            return tempArr;
        }
    }

    function Unix_timestamp(t) {
        var date = new Date(t * 1000);
        var year = date.getFullYear();
        var month = "0" + (date.getMonth() + 1);
        var day = "0" + date.getDate();
        return year + "년 " + month.substr(-2) + "월 " + day.substr(-2) + "일 ";
    }

    return (
        <div>
            {lastDate === "" ? <NoDiary userName={props.userName} diaryList={diaryList} lastDate={lastDate}
                                        navigateToWriting={navigateToWriting}
                                        navigateToReview={navigateToReview} Unix_timestamp={Unix_timestamp}/> :
                <Diary userName={props.userName} diaryList={diaryList} lastDate={lastDate}
                                  navigateToWriting={navigateToWriting}
                                  navigateToReview={navigateToReview} Unix_timestamp={Unix_timestamp}/>}
        </div>
    );
}

// function NoDiary(props) {
//     return (
//         <Container>
//             <Row>

       
//                 <div className="loading_box_home_top">
            
//                     <span className="desktop-view">
//                         <b>안녕하세요</b> 😀<br/>Pocket Mind에 오신걸 환영합니다.
//             </span>
//                     <span className="smartphone-view">
//                         <b>안녕하세요</b> 😀<br/> 환영해요
//             </span>

//                 </div>
//             </Row>
//             <Row>
//                 <div className="loading_box_home_bottom">

//                     <span className="desktop-view">
//                         <div>🥲 아직 작성한 일기가 없어요. 첫 일기를 작성해볼까요?
//                         </div>
//                         &nbsp;
//                         <div><Button
//                             variant="primary"
//                             style={{backgroundColor: "007AFF", fontWeight: "600"}}
//                             onClick={props.navigateToWriting}>
//                             📝 오늘의 일기 작성하러 가기
//                         </Button>
//                        </div>
//                     </span>
//                     <span className="smartphone-view-text">
//                         🥲 아직 작성한 일기가 없어요.<br/>첫 일기를 작성해볼까요?
//                     <div className="d-grid gap-2">
//                             &nbsp;
//                         <Button
//                             variant="primary"
//                             style={{backgroundColor: "007AFF", fontWeight: "600"}}
//                             onClick={props.navigateToWriting}>
//                             📝 오늘의 일기 작성하러 가기
//                         </Button>

//                         </div>

//                     </span>

//                 </div>
//                 <span className="center_temp">
//                     &nbsp;

//                     <Row xs={1} md={2} className="g-4">

//                     <Col>
//                         <Card>
//                             <Card.Img variant="top" src={book_purple}/>
//                             <Card.Body>
//                                 <Card.Title><b>일기쓰기와 정신건강</b></Card.Title>
//                                 <Card.Text>
//                                     일기를 작성하는 것이 어떻게 정신건강에 도움이 될까요?
//                                 </Card.Text>
//                             </Card.Body>
//                         </Card>
//                     </Col>
//                     <Col>
//                         <Card>
//                             <Card.Img variant="top" src={chat}/>
//                             <Card.Body>
//                                 <Card.Title><b>누구와 말하는 건가요?</b></Card.Title>
//                                 <Card.Text>
//                                     마음챙김 다이어리가 어떻게 동작 원리에 대해 알아봅니다.
//                                 </Card.Text>
//                             </Card.Body>
//                         </Card>
//                     </Col>
//                     <Col>
//                         <Card>
//                             <Card.Img variant="top" src={lock}/>
//                             <Card.Body>
//                                 <Card.Title><b>개인정보는 어떻게 관리되나요?</b></Card.Title>
//                                 <Card.Text>
//                                     나의 데이터는 어떻게 관리되는지 알아봅니다.
//                                 </Card.Text>
//                             </Card.Body>
//                         </Card>
//                     </Col>
//                     <Col>
//                         <Card>
//                             <Card.Img variant="top" src={book_blue}/>
//                             <Card.Body>
//                                 <Card.Title><b>어떻게 적는건가요?</b></Card.Title>
//                                 <Card.Text>
//                                     정신건강에 도움이 되는 일상 기록이란?
//                                 </Card.Text>
//                             </Card.Body>
//                         </Card>
//                     </Col>
//                 </Row>

//                 </span>
//             </Row>
//             <div className="footer"></div>
//         </Container>
//     )
// }

// function Loading_complete(props) {
//     return (
//         <Container>
//             <Row>
//                 <div className="loading_box_home_top">
//         안녕하세요
//                     {/* <span className="desktop-view">
//                         <b>안녕하세요</b> 😀<br/>마음챙김 다이어리에 오신걸 환영합니다.
//             </span>
//                     <span className="smartphone-view">
//                         <b>안녕하세요</b> 😀<br/> 환영해요
//             </span> */}

//                 </div>
//             </Row>
//             <Row>
//                 <div className="loading_box_home_bottom">

//                     <span className="desktop-view">
// <div>
//                         📅 마지막으로 작성한 일기는 <b>{props.Unix_timestamp(props.lastDate)}</b> 일기에요.
//                         <br/>
//                         📖 지금까지 <b>{props.diaryList.length}</b>개의 일기를 작성하셨네요!
//                     </div>
//                         &nbsp;
//                         <div>

//                             <Button
//                                 variant="primary"
//                                 style={{backgroundColor: "007AFF", fontWeight: "600"}}
//                                 onClick={props.navigateToWriting}>
//                             📝 오늘의 일기 작성하러 가기
//                         </Button>
//                         &nbsp;&nbsp;
//                             <Button
//                             variant="dark"
//                             style={{backgroundColor: "6c757d", fontWeight: "600"}}
//                             onClick={props.navigateToReview}>
//                             📖 작성한 일기 다시보기
//                         </Button>

//                        </div>
//                     </span>
//                     <span className="smartphone-view-text">
// <div>
//                         📅 마지막 일기는 <b>{props.Unix_timestamp(props.lastDate)}</b> 일기에요.
//                         <br/>
//                         📖 지금까지 <b>{props.diaryList.length}</b>개의 일기를 작성하셨네요!

//                     </div>
//                         <div className="d-grid gap-2">
//                             &nbsp;
//                             <Button
//                                 variant="primary"
//                                 style={{backgroundColor: "007AFF", fontWeight: "600"}}
//                                 onClick={props.navigateToWriting}>
//                             📝 오늘의 일기 작성하러 가기
//                         </Button>

//                         <Button
//                             variant="dark"
//                             style={{backgroundColor: "6c757d", fontWeight: "600"}}
//                             onClick={props.navigateToReview}>
//                             📖 작성한 일기 다시보기
//                         </Button>
//                         </div>
//                             </span>

//                 </div>
//                 <span className="center_temp">
//                     &nbsp;

//                     <Row xs={1} md={2} className="g-4">

//                     <Col>
//                         <Card>
//                             <Card.Img variant="top" src={book_purple}/>
//                             <Card.Body>
//                                 <Card.Title><b>일기쓰기와 정신건강</b></Card.Title>
//                                 <Card.Text>
//                                     일기를 작성하는 것이 어떻게 정신건강에 도움이 될까요?
//                                 </Card.Text>
//                             </Card.Body>
//                         </Card>
//                     </Col>
//                     <Col>
//                         <Card>
//                             <Card.Img variant="top" src={chat}/>
//                             <Card.Body>
//                                 <Card.Title><b>누구와 말하는 건가요?</b></Card.Title>
//                                 <Card.Text>
//                                     마음챙김 다이어리가 어떻게 동작 원리에 대해 알아봅니다.
//                                 </Card.Text>
//                             </Card.Body>
//                         </Card>
//                     </Col>
//                     <Col>
//                         <Card>
//                             <Card.Img variant="top" src={lock}/>
//                             <Card.Body>
//                                 <Card.Title><b>개인정보는 어떻게 관리되나요?</b></Card.Title>
//                                 <Card.Text>
//                                     나의 데이터는 어떻게 관리되는지 알아봅니다.
//                                 </Card.Text>
//                             </Card.Body>
//                         </Card>
//                     </Col>
//                     <Col>
//                         <Card>
//                             <Card.Img variant="top" src={book_blue}/>
//                             <Card.Body>
//                                 <Card.Title><b>어떻게 적는건가요?</b></Card.Title>
//                                 <Card.Text>
//                                     정신건강에 도움이 되는 일상 기록이란?
//                                 </Card.Text>
//                             </Card.Body>
//                         </Card>
//                     </Col>
//                 </Row>

//                 </span>
//             </Row>
//             <div className="footer"></div>
//         </Container>
//     )
// }

export default Home;