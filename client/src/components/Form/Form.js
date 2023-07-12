import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
} from "@material-ui/core";
import { useDispatch, useSelector } from "react-redux";
import FileBase from "react-file-base64";
import { useHistory } from "react-router-dom";
import ChipInput from "material-ui-chip-input";
import AddIcon from "@material-ui/icons/Add";

import { createPost, updatePost } from "../../actions/posts";
import useStyles from "./styles";

const Form = ({ currentId, setCurrentId }) => {
  const [postData, setPostData] = useState({
    title: "",
    message: "",
    tags: [],
    selectedFile: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const post = useSelector((state) =>
    currentId
      ? state.posts.posts.find((message) => message._id === currentId)
      : null
  );
  const dispatch = useDispatch();
  const classes = useStyles();
  const user = JSON.parse(localStorage.getItem("profile"));
  const history = useHistory();
  const fileInputRef = useRef(null);

  const clear = () => {
    setCurrentId(0);
    setPostData({ title: "", message: "", tags: [], selectedFile: "" });
  };

  useEffect(() => {
    if (!post?.title) clear();
    if (post) setPostData(post);
  }, [post]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current.click();
  }, []);

  const handleDrop = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64String = e.target.result;

        const imageUrl = await uploadImageToCloudinary(base64String);
        setIsUploading(false);
        setPostData({ ...postData, selectedFile: imageUrl });
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentId === 0) {
      dispatch(createPost({ ...postData, name: user?.result?.name }, history));
      clear();
    } else {
      dispatch(
        updatePost(currentId, { ...postData, name: user?.result?.name })
      );
      clear();
    }
  };

  if (!user?.result?.name) {
    return (
      <Paper className={classes.paper} elevation={6}>
        <Typography variant="h6" align="center">
          Please Sign In to create your own memories and like other's memories.
        </Typography>
      </Paper>
    );
  }

  const handleAddChip = (tag) => {
    setPostData({ ...postData, tags: [...postData.tags, tag] });
  };

  const handleDeleteChip = (chipToDelete) => {
    setPostData({
      ...postData,
      tags: postData.tags.filter((tag) => tag !== chipToDelete),
    });
  };

  const uploadImageToCloudinary = async (base64Image) => {
    setIsUploading(true);
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/dylagiij7/image/upload`;
    const data = {
      file: base64Image,
      upload_preset: "myAppUpload",
    };

    try {
      const response = await fetch(cloudinaryUrl, {
        body: JSON.stringify(data),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const responseData = await response.json();
      return responseData.secure_url;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  return (
    <Paper className={classes.paper} elevation={6}>
      <form
        autoComplete="off"
        noValidate
        className={`${classes.root} ${classes.form}`}
        onSubmit={handleSubmit}
      >
        <Typography variant="h6">
          {currentId ? `Editing "${post?.title}"` : "Creating a Memory"}
        </Typography>
        <TextField
          name="title"
          variant="outlined"
          label="Title"
          fullWidth
          value={postData.title}
          onChange={(e) => setPostData({ ...postData, title: e.target.value })}
        />
        <TextField
          name="message"
          variant="outlined"
          label="Message"
          fullWidth
          multiline
          rows={4}
          value={postData.message}
          onChange={(e) =>
            setPostData({ ...postData, message: e.target.value })
          }
        />
        <div style={{ padding: "5px 0", width: "94%" }}>
          <ChipInput
            name="tags"
            variant="outlined"
            label="Tags"
            fullWidth
            value={postData.tags}
            onAdd={(chip) => handleAddChip(chip)}
            onDelete={(chip) => handleDeleteChip(chip)}
          />
        </div>
        <div className={classes.fileInput}>
          <div
            style={{
              border: "1px dashed rgba(0, 0, 0, 0.87)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "160px",
              width: "100%",
            }}
            className="image-uploader"
            onClick={handleUploadClick}
          >
            {isUploading ? (
              <CircularProgress />
            ) : postData?.selectedFile ? (
              <img
                style={{
                  width: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
                src={postData?.selectedFile}
              />
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDrop}
                  ref={fileInputRef}
                  style={{ display: "none" }}
                />

                <div className="plus-icon">
                  <AddIcon />
                </div>
              </>
            )}
          </div>
        </div>
        <Button
          className={classes.buttonSubmit}
          variant="contained"
          color="primary"
          size="large"
          type="submit"
          fullWidth
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          size="small"
          onClick={clear}
          fullWidth
        >
          Clear
        </Button>
      </form>
    </Paper>
  );
};

export default Form;
