package common

#Identifier: string & !=""
#Timestamp:  string & !=""
#DateOnly:   string & !=""
#Text:       string

#Email: string & =~"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"
#Url:   string & =~"^[a-zA-Z][a-zA-Z0-9+.-]*://.+$"
