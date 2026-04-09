import os

def fix_01():
    nb_path = r"C:\Users\thiranbarath\Documents\GitHub\project-d\machineLearning\source code\01_ML_Data_Prep.ipynb"
    with open(nb_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Fix SEVERITY encoding mapping
    old_severity = "df['Severity_Encoded'] = df['SEVERITY_INDEX'].map(severity_mapping)"
    new_severity = "df['Severity_Encoded'] = df['SEVERITY_INDEX'].map(severity_mapping).fillna(0) # 0 = Mild as safe fallback"
    
    if old_severity in content:
        content = content.replace(old_severity, new_severity)
        print("Replaced Severity mapping logic.")
    
    # Fix SEX one hot encoding drop_first
    old_sex = "df_ml = pd.get_dummies(df_ml, columns=['SEX'], drop_first=True, dtype=int)"
    new_sex = "df_ml = pd.get_dummies(df_ml, columns=['SEX'], drop_first=False, dtype=int)"
    
    if old_sex in content:
        content = content.replace(old_sex, new_sex)
        print("Replaced SEX one-hot encoding logic.")

    with open(nb_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("01_ML_Data_Prep.ipynb updated successfully.")

if __name__ == "__main__":
    fix_01()
