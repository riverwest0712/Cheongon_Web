from flask import Flask, jsonify
import pymysql

app = Flask(__name__)
app.json.ensure_ascii = False

# DB 연결
db = pymysql.connect(
    host="127.0.0.1",
    user="first",
    password="first",
    database="madang_a",
    charset="utf8"
)

@app.route('/review/<policy_id>')
def review(policy_id):
    cursor = db.cursor()

    # 댓글 조회
    sql = """
    SELECT comment_text
    FROM policy_comment
    WHERE policy_id = %s
    """
    cursor.execute(sql, (policy_id,))
    rows = cursor.fetchall()

    positive = 0
    negative = 0

    for row in rows:
        text = row[0]

        if "좋" in text or "만족" in text or "추천" in text:
            positive += 1

        if "불편" in text or "어렵" in text or "복잡" in text:
            negative += 1

    # 한줄평 생성
    if positive > negative:
        summary = "지원 만족도가 높다는 의견이 많습니다."
    elif negative > positive:
        summary = "신청 절차가 복잡하다는 의견이 많습니다."
    else:
        summary = "긍정과 부정 의견이 비슷합니다."

    return jsonify({
        "policy_id": policy_id,
        "comment_count": len(rows),
        "summary": summary
    })

if __name__ == '__main__':
    app.run(debug=True)


#http://localhost:5000/review/20250716005400111306 >>>>>위 코드 실행한 다음에 브라우저에 링크 접속