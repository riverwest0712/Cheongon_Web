import mysql.connector

# ---------------------------
# DB 연결
# ---------------------------
conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="manager",
    database="cheongon"
)
cursor = conn.cursor(dictionary=True)

# ---------------------------
# 추천 대상 사용자 ID
# ---------------------------
target_user_id = 1

# ---------------------------
# 1. 사용자 조건 가져오기z
# ---------------------------
cursor.execute("""
    SELECT *
    FROM users
    WHERE users_id = %s
""", (target_user_id,))
user = cursor.fetchone()

if not user:
    print("해당 사용자의 조건 데이터가 없습니다.")
    conn.close()
    exit()

# ---------------------------
# 2. 정책 전체 가져오기
# ---------------------------
cursor.execute("SELECT * FROM policy")
policies = cursor.fetchall()

# ---------------------------
# 3. 기존 추천 결과 삭제 (같은 사용자 재추천 시)
# ---------------------------
cursor.execute("DELETE FROM recommendation WHERE users_id = %s", (target_user_id,))

# ---------------------------
# 4. 점수 계산 함수
# ---------------------------
def calculate_score(user, policy):
    total_score = 0
    detail = []

    age_score = 0
    gender_score = 0
    region_score = 0
    employment_score = 0
    household_score = 0
    vulnerable_score = 0
    military_score = 0
    income_score = 0

    # 나이
    if policy.get("min_age") is not None and policy.get("max_age") is not None:
        if user["age"] is not None and policy["min_age"] <= user["age"] <= policy["max_age"]:
            age_score = 20
            detail.append("연령 조건 충족")
    else:
        age_score = 10
        detail.append("연령 제한 없음")

    # 성별
    gender_condition = policy.get("gender_condition")
    if gender_condition is None or gender_condition.lower() == "all":
        gender_score = 10
        detail.append("성별 제한 없음")
    elif user["gender"] and gender_condition.lower() == user["gender"].lower():
        gender_score = 10
        detail.append("성별 조건 충족")

    # 지역
    region_condition = policy.get("region_condition") or policy.get("region")
    if region_condition is None:
        region_score = 10
        detail.append("지역 제한 없음")
    elif user["region"] and user["region"] in region_condition:
        region_score = 20
        detail.append("지역 조건 충족")

    # 재직 상태
    employment_condition = policy.get("employment_condition")
    if employment_condition is None or employment_condition == "무관":
        employment_score = 10
        detail.append("재직 상태 무관")
    elif user["employment_status"] and user["employment_status"] == employment_condition:
        employment_score = 15
        detail.append("재직 상태 조건 충족")

    # 가구 특성
    household_condition = policy.get("household_condition")
    if household_condition is None or household_condition == "무관":
        household_score = 10
        detail.append("가구 조건 무관")
    elif user.get("household_type") and user["household_type"] == household_condition:
        household_score = 15
        detail.append("가구 특성 조건 충족")

    # 취약계층
    vulnerable_condition = policy.get("vulnerable_condition")
    if vulnerable_condition is None or vulnerable_condition == "무관":
        vulnerable_score = 5
        detail.append("취약계층 조건 무관")
    elif user.get("vulnerable_status") and user["vulnerable_status"] == vulnerable_condition:
        vulnerable_score = 10
        detail.append("취약계층 조건 충족")

    # 병역
    military_condition = policy.get("military_condition")
    if military_condition is None or military_condition == "무관":
        military_score = 5
        detail.append("병역 조건 무관")
    elif user.get("military_status") and user["military_status"] == military_condition:
        military_score = 5
        detail.append("병역 조건 충족")

    # 소득
    min_income = policy.get("min_income")
    max_income = policy.get("max_income")

    if user["income"] is not None:
        if (min_income is None or user["income"] >= min_income) and (max_income is None or user["income"] <= max_income):
            income_score = 15
            detail.append("소득 조건 충족")

    total_score = (
        age_score + gender_score + region_score + employment_score +
        household_score + vulnerable_score + military_score + income_score
    )

    return {
        "score": total_score,
        "age_score": age_score,
        "gender_score": gender_score,
        "region_score": region_score,
        "employment_score": employment_score,
        "household_score": household_score,
        "vulnerable_score": vulnerable_score,
        "military_score": military_score,
        "income_score": income_score,
        "detail_reason": ", ".join(detail)
    }

# ---------------------------
# 5. 정책별 점수 계산
# ---------------------------
results = []

for policy in policies:
    result = calculate_score(user, policy)

    # 점수가 40점 이상인 것만 추천 대상으로 예시 처리
    if result["score"] >= 40:
        results.append({
            "policy_id": policy["policy_id"],
            "score": result["score"],
            "age_score": result["age_score"],
            "gender_score": result["gender_score"],
            "region_score": result["region_score"],
            "employment_score": result["employment_score"],
            "household_score": result["household_score"],
            "vulnerable_score": result["vulnerable_score"],
            "military_score": result["military_score"],
            "income_score": result["income_score"],
            "detail_reason": result["detail_reason"]
        })

# ---------------------------
# 6. 점수 순 정렬
# ---------------------------
results.sort(key=lambda x: x["score"], reverse=True)

# ---------------------------
# 7. recommendation 자동 저장
# ---------------------------
insert_sql = """
INSERT INTO recommendation (
    users_id, policy_id, score, match_percent, reason, recommended_at,
    rank_no, age_score, gender_score, region_score, employment_score,
    household_score, vulnerable_score, military_score, income_score, detail_reason
)
VALUES (%s, %s, %s, %s, %s, NOW(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

for idx, r in enumerate(results, start=1):
    match_percent = round(r["score"], 2)
    reason = "추천 조건 매칭 결과"

    cursor.execute(insert_sql, (
        target_user_id,
        r["policy_id"],
        r["score"],
        match_percent,
        reason,
        idx,
        r["age_score"],
        r["gender_score"],
        r["region_score"],
        r["employment_score"],
        r["household_score"],
        r["vulnerable_score"],
        r["military_score"],
        r["income_score"],
        r["detail_reason"]
    ))

conn.commit()

print(f"{len(results)}개의 추천 결과가 저장되었습니다.")

cursor.close()
conn.close()