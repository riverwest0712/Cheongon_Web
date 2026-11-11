DROP DATABASE IF EXISTS cheongon;
CREATE DATABASE cheongon;
USE cheongon;

-- 사용자테이블
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL, -- 아이디 중복 방지
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    age INT, -- 연령
    gender VARCHAR(10), -- 성별 (male / female)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 주거정책 테이블 

CREATE TABLE policies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    min_age INT, -- 최소 연령
    max_age INT, -- 최대 연령
    --
    gender VARCHAR(10) -- all / male / female
);

-- 추천결과 저장
CREATE TABLE user_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    policy_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (policy_id) REFERENCES policies(id)
);