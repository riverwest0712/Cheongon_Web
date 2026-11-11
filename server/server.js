require('dotenv').config();

const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../화면")));

// DB 연결
const db = mysql.createConnection({
  host: "localhost",
  user: "cheongon",
  password: "manager",
  database: "cheongon",
});

db.connect((err) => {
  if (err) {
    console.error("DB 연결 실패:", err);
  } else {
    console.log("DB 연결 성공");
  }
});

// 회원가입
app.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).send("항목을 전부 입력해주세요.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.status(400).send("올바른 이메일 형식이 아닙니다.");
  }

  const passwordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

  if (!passwordRegex.test(password)) {
    return res.status(400).send(
      "비밀번호는 영어, 숫자, 특수문자를 포함한 8자 이상이어야 합니다."
    );
  }

  try {
    const hashed = await bcrypt.hash(password, 10);

    const sql = "INSERT INTO users (email, password, name) VALUES (?, ?, ?)";

    db.query(sql, [email, hashed, name], (err) => {
      if (err) {
        console.error("DB 쿼리 오류:", err);
        return res.status(400).send("이미 존재하는 이메일입니다.");
      }

      res.send("회원가입 완료!");
    });
  } catch (err) {
    console.error("서버 오류:", err);
    res.status(500).send("서버 오류");
  }
});



// 로그인
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";

  db.query(sql, [email], async (err, result) => {
    if (err) {
      console.error("DB 오류:", err);
      return res.status(500).send("DB 오류");
    }

    if (result.length === 0) {
      return res.status(400).json({
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    const user = result[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    res.json({
      message: "로그인 성공",
      user: {
        id: user.users_id,
        email: user.email,
        name: user.name,
      },
    });
  });
});

// 전체 정책 조회
app.get("/api/policy", (req, res) => {
  const sql = "SELECT * FROM policy LIMIT 100";

  db.query(sql, (err, result) => {
    if (err) {
      console.error("정책 조회 DB 오류:", err);
      return res.status(500).send("정책 조회 실패");
    }

    res.json(result);
  });
});

// 정책 상세 조회
app.get("/api/policy/:policy_id", (req, res) => {
  const { policy_id } = req.params;

  const sql = `
    SELECT *
    FROM policy
    WHERE policy_id = ?
  `;

  db.query(sql, [policy_id], (err, result) => {
    if (err) {
      console.error("정책 상세 조회 오류:", err);

      return res.status(500).json({
        message: "정책 조회 실패",
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "정책 없음",
      });
    }

    const policy = result[0];

    // 좋아요 / 싫어요 조회
    const statsSql = `
      SELECT
        SUM(CASE WHEN reaction = 'like' THEN 1 ELSE 0 END) AS likes,
        SUM(CASE WHEN reaction = 'dislike' THEN 1 ELSE 0 END) AS dislikes
      FROM policy_reaction
      WHERE policy_id = ?
    `;

    db.query(statsSql, [policy_id], (statsErr, statsResult) => {
      if (statsErr) {
        console.error("리액션 조회 오류:", statsErr);

        return res.status(500).json({
          message: "리액션 조회 실패",
        });
      }

      // 댓글 조회
      const commentSql = `
        SELECT
          c.comment_id,
          c.comment_text,
          u.name AS nick
        FROM comment c
        JOIN users u
          ON c.users_id = u.users_id
        WHERE c.policy_id = ?
        ORDER BY c.created_at DESC
      `;

      db.query(commentSql, [policy_id], (commentErr, commentResult) => {
        if (commentErr) {
          console.error("댓글 조회 오류:", commentErr);

          return res.status(500).json({
            message: "댓글 조회 실패",
          });
        }

        res.json({
          policy: {
            policy_id: policy.policy_id,

            title: policy.policy_name || "-",

            period:
              `${policy.start_date || "-"} ~ ${policy.end_date || "상시"}`,

            organization: policy.organization || "-",

            min_age: policy.min_age,

            max_age: policy.max_age,

            description: policy.description || "-",

            support_content: policy.support_content || "-",

            apply_url: policy.apply_url || "",

            category: policy.category || "-",

            region: policy.region || "-",
          },

          stats: {
            likes: statsResult[0].likes || 0,
            dislikes: statsResult[0].dislikes || 0,
          },

          comments: commentResult || [],
        });
      });
    });
  });
});

// 사용자 조건 저장
app.post("/api/user-conditions", (req, res) => {
  const {
    users_id,
    age,
    gender,
    region,
    employment_status,
    household_type,
    vulnerable_status,
    military_status,
    income,
    marital_status,
    education_status,
  } = req.body;

  const sql = `
    INSERT INTO user_conditions (
      users_id,
      age,
      gender,
      region,
      employment_status,
      household_type,
      vulnerable_status,
      military_status,
      income,
      marital_status,
      education_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      users_id,
      age,
      gender,
      region,
      employment_status,
      household_type,
      vulnerable_status,
      military_status,
      income,
      marital_status || null,
      education_status || null,
    ],
    (err, result) => {
      if (err) {
        console.error("조건 저장 DB 오류:", err);
        return res.status(500).json({
          message: "조건 저장 실패",
          error: err.sqlMessage,
        });
      }

      res.json({
        message: "조건 저장 성공",
        condition_id: result.insertId,
      });
    }
  );
});

// 최신 조건 기준 추천 정책 조회
app.get("/api/recommendations/:users_id", (req, res) => {
  const users_id = req.params.users_id;

  const sql = `
    SELECT
      p.policy_id AS id,
      p.policy_name AS title,
      p.description AS description,
      p.region AS region,
      p.category AS category,
      p.end_date AS end_date,
      p.apply_url AS apply_url,

      CASE
        WHEN p.end_date IS NULL THEN '상시'
        ELSE DATE_FORMAT(p.end_date, '%Y-%m-%d')
      END AS deadlineText,

      CASE
        -- 거주지 불일치
        WHEN p.region IS NOT NULL
         AND u.region IS NOT NULL
         AND p.region NOT LIKE CONCAT('%', u.region, '%')
        THEN 0

        -- 나이 불일치
        WHEN (p.min_age IS NOT NULL AND u.age < p.min_age)
          OR (p.max_age IS NOT NULL AND u.age > p.max_age)
        THEN 0

        -- 성별 불일치
        WHEN p.gender_condition IS NOT NULL
         AND p.gender_condition <> u.gender
        THEN 0

        -- 병역 상태 불일치
        WHEN p.military_condition IS NOT NULL
         AND p.military_condition <> u.military_status
        THEN 0

        -- 재직 상태 불일치
        WHEN p.employment_condition IS NOT NULL
         AND p.employment_condition <> u.employment_status
        THEN 0

        ELSE
        (
          50
          +
          CASE
            WHEN (p.min_income IS NULL OR p.min_income <= u.income)
             AND (p.max_income IS NULL OR p.max_income >= u.income)
            THEN 20
            ELSE 0
          END
          +
          CASE
            WHEN p.household_condition IS NOT NULL
             AND p.household_condition = u.household_type
            THEN 15
            ELSE 0
          END
          +
          CASE
            WHEN p.vulnerable_condition IS NOT NULL
             AND p.vulnerable_condition = u.vulnerable_status
            THEN 15
            ELSE 0
          END
        )
      END AS score,

      '조건 기반으로 추천되었습니다.' AS reason

    FROM user_conditions u
    JOIN policy p

    WHERE u.users_id = ?
      AND u.condition_id = (
        SELECT MAX(condition_id)
        FROM user_conditions
        WHERE users_id = ?
      )

      AND (
        CASE 
          WHEN p.start_date REGEXP '^[0-9]{8}$'
            THEN STR_TO_DATE(p.start_date, '%Y%m%d')
          WHEN p.start_date REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            THEN STR_TO_DATE(p.start_date, '%Y-%m-%d')
          ELSE '1900-01-01'
        END
      ) <= CURDATE()

      AND (
        CASE
          WHEN p.end_date REGEXP '^[0-9]{8}$'
            THEN STR_TO_DATE(p.end_date, '%Y%m%d')
          WHEN p.end_date REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            THEN STR_TO_DATE(p.end_date, '%Y-%m-%d')
          ELSE '9999-12-31'
        END
      ) >= CURDATE()

    HAVING score > 0
    ORDER BY score DESC
  `;

  db.query(sql, [users_id, users_id], (err, result) => {
    if (err) {
      console.error("추천 정책 조회 오류:", err);
      return res.status(500).json({
        message: "추천 정책 조회 실패",
        error: err.sqlMessage,
      });
    }

    res.json(result);
  });
});

// 추천 정책 저장
app.post("/api/recommendations/save", (req, res) => {
  const { users_id, recommendations } = req.body;

  if (!users_id || !recommendations || recommendations.length === 0) {
    return res.status(400).json({
      message: "저장할 추천 정책이 없습니다.",
    });
  }

  const deleteSql = `
    DELETE FROM recommendation
    WHERE users_id = ?
  `;

  db.query(deleteSql, [users_id], (deleteErr) => {
    if (deleteErr) {
      console.error("기존 추천 삭제 오류:", deleteErr);
      return res.status(500).json({
        message: "기존 추천 삭제 실패",
        error: deleteErr.sqlMessage,
      });
    }

    const insertSql = `
      INSERT INTO recommendation
      (users_id, policy_id, score, match_percent, reason)
      VALUES ?
    `;

    const values = recommendations.map((policy) => [
      users_id,
      policy.id || policy.policy_id,
      policy.score || 0,
      policy.match_percent || policy.score || 0,
      policy.reason || "조건 기반으로 추천되었습니다.",
    ]);

    db.query(insertSql, [values], (insertErr) => {
      if (insertErr) {
        console.error("추천 저장 오류:", insertErr);
        return res.status(500).json({
          message: "추천 정책 저장 실패",
          error: insertErr.sqlMessage,
        });
      }

      res.json({
        message: "추천 정책 저장 성공",
      });
    });
  });
});

// 마이페이지 추천 정책 조회
app.get("/api/mypage/:users_id", (req, res) => {
  const users_id = req.params.users_id;

  const sql = `
    SELECT
      r.rec_id,
      r.users_id,
      r.policy_id,
      r.score,
      r.match_percent,
      r.reason,
      r.recommended_at,

      p.policy_name,
      p.category,
      p.category_main,
      p.category_sub,
      p.description,
      p.support_content,
      p.region,
      p.organization,
      p.apply_url,
      p.start_date,
      p.end_date,
      p.support_type,
      p.housing_type,
      p.rent_support,
      p.deposit_support,
      p.house_ownership

    FROM recommendation r
    JOIN policy p
      ON r.policy_id = p.policy_id
    WHERE r.users_id = ?
    ORDER BY r.match_percent DESC
  `;

  db.query(sql, [users_id], (err, result) => {
    if (err) {
      console.error("마이페이지 조회 오류:", err);
      return res.status(500).json({
        message: "마이페이지 조회 실패",
        error: err.sqlMessage,
      });
    }

    res.json(result);
  });
});

// 외부 정책 API 조회
app.get("/policies", async (req, res) => {
  try {
    const response = await axios.get(
      "https://www.youthcenter.go.kr/go/ythip/getPlcy",
      {
        params: {
          apiKeyNm: "29b26499-f479-4ff9-ac6a-f3cd799f532c",
          pageNum: 1,
          pageSize: 10,
          rtnType: "json",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error("외부 API 오류:", err);
    res.status(500).send("외부 API 오류");
  }
});

// 관심 정책 저장
app.post("/api/bookmark", (req, res) => {
  const { users_id, policy_id } = req.body;

  const sql = `
    INSERT IGNORE INTO bookmark (users_id, policy_id)
    VALUES (?, ?)
  `;

  db.query(sql, [users_id, policy_id], (err) => {
    if (err) {
      console.error("찜 저장 오류:", err);
      return res.status(500).json({ message: "찜 저장 실패" });
    }

    res.json({ message: "찜 저장 완료" });
  });
});

// 관심 정책 조회
app.get("/api/bookmark/:users_id", (req, res) => {
  const { users_id } = req.params;

  const sql = `
    SELECT 
      b.bookmark_id,
      p.*
    FROM bookmark b
    JOIN policy p ON b.policy_id = p.policy_id
    WHERE b.users_id = ?
  `;

  db.query(sql, [users_id], (err, result) => {
    if (err) {
      console.error("관심 정책 조회 오류:", err);
      return res.status(500).json({ message: "관심 정책 조회 실패" });
    }

    res.json(result);
  });
});

// 관심 정책 삭제
app.delete("/api/bookmark/:bookmark_id", (req, res) => {
  const { bookmark_id } = req.params;

  console.log("삭제 요청 bookmark_id:", bookmark_id);

  const sql = `
    DELETE FROM bookmark
    WHERE bookmark_id = ?
  `;

  db.query(sql, [bookmark_id], (err, result) => {
    if (err) {
      console.error("관심 정책 삭제 오류:", err);
      return res.status(500).json({ message: "삭제 실패" });
    }

    console.log("삭제된 행 개수:", result.affectedRows);

    res.json({
      message: "삭제 완료",
      deletedCount: result.affectedRows,
    });
  });
});

// 좋아요 / 싫어요 저장
app.post("/api/reaction", (req, res) => {
  const { users_id, policy_id, reaction } = req.body;

  const sql = `
    INSERT INTO policy_reaction (users_id, policy_id, reaction)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
    reaction = VALUES(reaction)
  `;

  db.query(sql, [users_id, policy_id, reaction], (err) => {
    if (err) {
      console.error("리액션 저장 오류:", err);

      return res.status(500).json({
        message: "리액션 저장 실패",
      });
    }

    res.json({
      message: "리액션 저장 성공",
    });
  });
});

// 댓글 저장
app.post("/api/comment", (req, res) => {
  const { users_id, policy_id, comment_text } = req.body;

  const sql = `
    INSERT INTO comment (users_id, policy_id, comment_text)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [users_id, policy_id, comment_text], (err) => {
    if (err) {
      console.error("댓글 저장 오류:", err);

      return res.status(500).json({
        message: "댓글 저장 실패",
      });
    }

    res.json({
      message: "댓글 저장 성공",
    });
  });
});

// 댓글 삭제
app.delete("/api/comment/:comment_id", (req, res) => {

  const { comment_id } = req.params;

  const sql = `
    DELETE FROM comment
    WHERE comment_id = ?
  `;

  db.query(sql, [comment_id], (err, result) => {

    if (err) {
      console.error("댓글 삭제 오류:", err);

      return res.status(500).json({
        message: "댓글 삭제 실패",
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "댓글 없음",
      });
    }

    res.json({
      message: "댓글 삭제 성공",
    });
  });
});


//챗봇
// [학습 단계]
const SYSTEM_PROMPT = `
너의 이름은 '청냥이'고, 청년 정책 플랫폼 '청온'의 공식 마스코트야.
귀여운 느낌을 살리기 위해 모든 문장은 반드시 '~냥', '~다냥'으로 끝나야 해.

청년정책 플랫폼인 '청온'은 현재 청년 정책 중 주거 관련 서비스에 대해 맞춤형 매칭 정책 추천 서비스를 진행하고 있어. 
 
대한민국 청년들을 위한 주거 관련 정책에 대해 아주 잘 알고 있는 전문가처럼 행동해주되, 친절하고 따뜻하게 대답해줘!

만약 사용자가 '월세' 등으로 짧은 단어를 제시했다면, 월세 관련 정책이 궁금하신거냥? 시작하기 버튼을 누르고 정보를 입력하면 사용자님의 조건에 적합하는 월세 정보를 찾아볼 수 있다냥! 🐾 이런식으로 답변해줘.

[대화 예시]
사용자: 이 앱은 어떻게 사용하면 돼?
청냥이: 회원가입과 로그인을 한 후, 메인 페이지의 '맞춤 정책 찾기' 버튼을 누르면 된다냥! 또한 서비스 - 시작하기 버튼을 눌러도 시작할 수 있다냥! 🐾

사용자: 정책 혜택은 누구나 누릴 수 있는거야?
청냥이: 모든 청년이 다 받는 건 아니다냥! 보통 소득 기준과 재산 기준, 거주지 등 을 확인해야 한다냥. '시작하기' 버튼을 눌러 자신에게 맞는 정책을 미리 확인해볼 수 있다냥!
다만, 정확한 심사 결과는 공식 기관의 안내를 꼭 확인해야 한다냥! 🐾


`;

// [연동 및 구동] 챗봇 API
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userMessage }
                ],
                // [수정] 응답 속도를 위해 토큰 제한 및 다양성 조절
                max_tokens: 500, 
                temperature: 0.5, // 수치가 낮을수록 답변이 더 직관적이고 빨라진다냥
                presence_penalty: 0,
                frequency_penalty: 0
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10초 이상 걸리면 중단 (대기 시간 방지)
            }
        );

        res.json({ reply: response.data.choices[0].message.content });
    } catch (error) {
        console.error("AI 연결 오류:", error.message);
        res.status(500).json({ reply: "미안하다냥! 지금은 서버가 조금 바쁜 것 같다냥. 다시 말해달라냥!" });
    }
});

// 서버 실행
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행: http://localhost:${PORT}`);
});