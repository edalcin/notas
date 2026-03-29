package models

type Hashtag struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type HashtagsResponse struct {
	Hashtags []Hashtag `json:"hashtags"`
}
